import OpenAI from "openai";
import slugify from "slugify";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

export const LANGS = ["ru", "en"] as const;
export type Lang = (typeof LANGS)[number];

const LANG_NAMES: Record<Lang, string> = { ru: "Russian", en: "English" };
const MODEL = "gpt-4o-mini";
const NOT_CONFIGURED = "OPENAI_API_KEY sozlanmagan";

type TranslatableArticle = {
  id: string;
  title: string;
  summary: string;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
};

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

async function translateOne(article: TranslatableArticle, lang: Lang) {
  if (!client) {
    await prisma.articleTranslation.upsert({
      where: { articleId_lang: { articleId: article.id, lang } },
      update: { status: "PENDING", error: NOT_CONFIGURED },
      create: {
        articleId: article.id,
        lang,
        title: article.title,
        summary: article.summary,
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
            '{"title": string, "summary": string, "content": string, "seoTitle": string, "seoDescription": string}.'
        },
        {
          role: "user",
          content: JSON.stringify({
            title: article.title,
            summary: article.summary,
            content: article.content,
            seoTitle: article.seoTitle ?? article.title,
            seoDescription: article.seoDescription ?? article.summary
          })
        }
      ]
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("Bo'sh javob");
    const parsed = JSON.parse(text) as {
      title: string;
      summary: string;
      content: string;
      seoTitle?: string;
      seoDescription?: string;
    };

    const baseSlug =
      slugify(parsed.title, { lower: true, strict: true }) || slugify(`${article.title}-${lang}`, { lower: true, strict: true });
    const slug = await uniqueSlug(baseSlug, article.id, lang);

    await prisma.articleTranslation.upsert({
      where: { articleId_lang: { articleId: article.id, lang } },
      update: {
        title: parsed.title,
        summary: parsed.summary,
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
        content: parsed.content,
        seoTitle: parsed.seoTitle ?? parsed.title,
        seoDescription: parsed.seoDescription ?? parsed.summary,
        slug,
        status: "READY"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Noma'lum xatolik";
    await prisma.articleTranslation.upsert({
      where: { articleId_lang: { articleId: article.id, lang } },
      update: { status: "FAILED", error: message },
      create: {
        articleId: article.id,
        lang,
        title: article.title,
        summary: article.summary,
        content: article.content,
        slug: slugify(`${article.title}-${lang}`, { lower: true, strict: true }),
        status: "FAILED",
        error: message
      }
    });
  }
}

export function queueTranslations(article: TranslatableArticle) {
  for (const lang of LANGS) {
    void translateOne(article, lang).catch((error) => {
      console.error(`[translate] ${lang} failed for ${article.id}:`, error);
    });
  }
}

export async function regenerateTranslation(articleId: string, lang: Lang) {
  const article = await prisma.article.findUniqueOrThrow({ where: { id: articleId } });
  await translateOne(article, lang);
}
