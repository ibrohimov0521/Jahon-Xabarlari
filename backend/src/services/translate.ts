import OpenAI from "openai";
import slugify from "slugify";
import crypto from "node:crypto";
import { Queue, Worker } from "bullmq";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { createBullConnection } from "./redis.js";

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 2 }) : null;

export const LANGS = ["ru", "en"] as const;
export type Lang = (typeof LANGS)[number];

const LANG_NAMES: Record<Lang, string> = { ru: "Russian", en: "English" };
const MODEL = "gpt-4o-mini";
const NOT_CONFIGURED = "OPENAI_API_KEY sozlanmagan";

const translatedArticleSchema = z.object({
  title: z.string().trim().min(1).max(220),
  summary: z.string().trim().min(1).max(2_000),
  shortDescription: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1).max(250_000),
  seoTitle: z.string().trim().min(1).max(220),
  seoDescription: z.string().trim().min(1).max(500)
});

type TranslatableArticle = {
  id: string;
  title: string;
  summary: string;
  shortDescription: string | null;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
};

function translationRevision(article: TranslatableArticle) {
  return crypto
    .createHash("sha1")
    .update(
      JSON.stringify([
        article.title,
        article.summary,
        article.shortDescription,
        article.content,
        article.seoTitle,
        article.seoDescription
      ])
    )
    .digest("hex")
    .slice(0, 12);
}

async function isCurrentArticleRevision(articleId: string, expectedRevision: string) {
  const current = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      summary: true,
      shortDescription: true,
      content: true,
      seoTitle: true,
      seoDescription: true,
      deletedAt: true
    }
  });
  return !!current && !current.deletedAt && translationRevision(current) === expectedRevision;
}

async function uniqueSlug(base: string, articleId: string, lang: string) {
  let candidate = base;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.articleTranslation.findFirst({ where: { slug: candidate, lang, NOT: { articleId } } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function translateOne(article: TranslatableArticle, lang: Lang, expectedRevision = translationRevision(article)) {
  if (!client) {
    if (!(await isCurrentArticleRevision(article.id, expectedRevision))) return;
    await prisma.articleTranslation.upsert({
      where: { articleId_lang: { articleId: article.id, lang } },
      update: { status: "PENDING", error: NOT_CONFIGURED },
      create: {
        articleId: article.id,
        lang,
        title: article.title,
        summary: article.summary,
        shortDescription: article.shortDescription,
        content: article.content,
        slug: slugify(`${article.title}-${lang}`, { lower: true, strict: true }),
        status: "PENDING",
        error: NOT_CONFIGURED
      }
    });
    return;
  }

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You are a professional news translator. Translate the given Uzbek news article fields into ${LANG_NAMES[lang]}. ` +
            "Keep proper nouns, numbers and quotes accurate. Respond ONLY with strict JSON matching this shape: " +
            '{"title": string, "summary": string, "shortDescription": string, "content": string, "seoTitle": string, "seoDescription": string}.'
        },
        {
          role: "user",
          content: JSON.stringify({
            title: article.title,
            summary: article.summary,
            shortDescription: article.shortDescription ?? article.summary.slice(0, 500),
            content: article.content,
            seoTitle: article.seoTitle ?? article.title,
            seoDescription: article.seoDescription ?? article.summary
          })
        }
      ]
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("Bo'sh javob");
    const parsed = translatedArticleSchema.parse(JSON.parse(text));

    const baseSlug =
      slugify(parsed.title, { lower: true, strict: true }) || slugify(`${article.title}-${lang}`, { lower: true, strict: true });
    const slug = await uniqueSlug(baseSlug, article.id, lang);

    // The editor may have changed the article while the OpenAI request was in flight.
    // Never let an older response replace the PENDING state for the newer revision.
    if (!(await isCurrentArticleRevision(article.id, expectedRevision))) return;
    await prisma.articleTranslation.upsert({
      where: { articleId_lang: { articleId: article.id, lang } },
      update: {
        title: parsed.title,
        summary: parsed.summary,
        shortDescription: parsed.shortDescription,
        content: parsed.content,
        seoTitle: parsed.seoTitle ?? parsed.title,
        seoDescription: parsed.seoDescription ?? parsed.summary,
        slug,
        status: "READY",
        error: null
      },
      create: {
        articleId: article.id,
        lang,
        title: parsed.title,
        summary: parsed.summary,
        shortDescription: parsed.shortDescription,
        content: parsed.content,
        seoTitle: parsed.seoTitle ?? parsed.title,
        seoDescription: parsed.seoDescription ?? parsed.summary,
        slug,
        status: "READY"
      }
    });
  } catch (error) {
    // A newer revision owns the translation row now; its worker will set the final state.
    if (!(await isCurrentArticleRevision(article.id, expectedRevision))) return;
    const message = error instanceof Error ? error.message : "Noma'lum xatolik";
    await prisma.articleTranslation.upsert({
      where: { articleId_lang: { articleId: article.id, lang } },
      update: { status: "FAILED", error: message },
      create: {
        articleId: article.id,
        lang,
        title: article.title,
        summary: article.summary,
        shortDescription: article.shortDescription,
        content: article.content,
        slug: slugify(`${article.title}-${lang}`, { lower: true, strict: true }),
        status: "FAILED",
        error: message
      }
    });
    throw error instanceof Error ? error : new Error(message);
  }
}

type TranslationJob = { articleId: string; lang: Lang; revision: string };
type TranslationJobName = "translate";
const translationQueue = new Queue<TranslationJob, void, TranslationJobName>("article-translations", { connection: createBullConnection() });
const translationWorker = new Worker<TranslationJob, void, TranslationJobName>(
  "article-translations",
  async (job) => {
    const article = await prisma.article.findUniqueOrThrow({ where: { id: job.data.articleId } });
    if (article.deletedAt || translationRevision(article) !== job.data.revision) return;
    await translateOne(article, job.data.lang, job.data.revision);
  },
  { connection: createBullConnection(), concurrency: 3 }
);
translationWorker.on("failed", (job, error) => console.error(`[translate] job ${job?.id ?? "unknown"} failed:`, error));
translationWorker.on("error", (error) => console.error("[translate] worker Redis xatosi:", error));
translationQueue.on("error", (error) => console.error("[translate] queue Redis xatosi:", error));

export async function queueTranslations(article: TranslatableArticle) {
  const revision = translationRevision(article);
  const enqueueId = crypto.randomUUID();
  // An edited article must never keep serving translations of the previous revision.
  // Hide existing translations until the new revision has completed successfully.
  await prisma.articleTranslation.updateMany({
    where: { articleId: article.id, lang: { in: [...LANGS] } },
    data: { status: "PENDING", error: null }
  });
  for (const lang of LANGS) {
    void translationQueue
      .add(
        "translate",
        { articleId: article.id, lang, revision },
        {
          // A revision can recur when an editor reverts an article. Reusing only the content
          // hash would make BullMQ return the retained old job and leave the translation PENDING.
          jobId: `${article.id}-${lang}-${revision}-${enqueueId}`,
          attempts: 4,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: { age: 24 * 60 * 60, count: 2_000 },
          removeOnFail: { age: 7 * 24 * 60 * 60, count: 2_000 }
        }
      )
      .catch((error) => console.error(`[translate] ${lang} navbatga olinmadi for ${article.id}:`, error));
  }
}

export async function regenerateTranslation(articleId: string, lang: Lang) {
  const article = await prisma.article.findUniqueOrThrow({ where: { id: articleId } });
  await translateOne(article, lang);
}

export async function closeTranslationJobs() {
  await Promise.all([translationWorker.close(), translationQueue.close()]);
}
