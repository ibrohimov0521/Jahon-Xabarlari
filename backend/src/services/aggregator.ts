import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import OpenAI from "openai";
import Parser from "rss-parser";
import slugify from "slugify";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { buildSeoDescription, buildSeoTitle } from "../utils/seo.js";
import { extractFallbackFeedMedia, extractPrimaryFeedMedia, resolveArticleMedia } from "./aggregator-media.js";
import { inspectArticleQuality, normalizeArticleTags } from "./article-quality.js";
import { NEWS_SOURCES, type NewsSource } from "./aggregator-sources.js";
import { readTextResponse, safeFetch } from "./net-guard.js";
import { queueArticlePush } from "./push.js";
import { queueTranslations } from "./translate.js";
import { withRedisLock } from "./redis.js";

export { NEWS_SOURCES, type NewsSource };

export const MAX_AGGREGATOR_SOURCES = 100;
const SOURCE_FETCH_CONCURRENCY = 8;

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 2 }) : null;
const MODEL = "gpt-4o-mini";
const parser = new Parser<Record<string, unknown>, RawFeedItem>({
  timeout: 15_000,
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["content:encoded", "contentEncoded"]
    ] as any
  }
});
const AGGREGATOR_AUTHOR_EMAIL = "aggregator@jahonxabarlari.uz";
const AGGREGATOR_PUBLISH_STATUS_KEY = "aggregator.publishStatus";
const DEFAULT_AGGREGATOR_PUBLISH_STATUS = "PUBLISHED" as const;

export type AggregatorPublishStatus = "PUBLISHED" | "REVIEW";

function isAggregatorPublishStatus(value: string): value is AggregatorPublishStatus {
  return value === "PUBLISHED" || value === "REVIEW";
}

export async function getAggregatorPublishStatus(): Promise<AggregatorPublishStatus> {
  const setting = await prisma.setting.findUnique({ where: { key: AGGREGATOR_PUBLISH_STATUS_KEY } });
  if (setting && isAggregatorPublishStatus(setting.value)) return setting.value;

  await prisma.setting.upsert({
    where: { key: AGGREGATOR_PUBLISH_STATUS_KEY },
    update: { value: DEFAULT_AGGREGATOR_PUBLISH_STATUS },
    create: { key: AGGREGATOR_PUBLISH_STATUS_KEY, value: DEFAULT_AGGREGATOR_PUBLISH_STATUS }
  });
  return DEFAULT_AGGREGATOR_PUBLISH_STATUS;
}

export async function setAggregatorPublishStatus(status: AggregatorPublishStatus): Promise<AggregatorPublishStatus> {
  await prisma.setting.upsert({
    where: { key: AGGREGATOR_PUBLISH_STATUS_KEY },
    update: { value: status },
    create: { key: AGGREGATOR_PUBLISH_STATUS_KEY, value: status }
  });
  return status;
}
const DUPLICATE_THRESHOLD = 0.4;
const DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;

export async function ensureDefaultAggregatorSources() {
  const count = await prisma.aggregatorSource.count();
  if (count > 0) return;
  await prisma.aggregatorSource.createMany({
    data: NEWS_SOURCES.map((source) => ({ ...source, enabled: true })),
    skipDuplicates: true
  });
}

export async function getAggregatorSources(options: { enabledOnly?: boolean } = {}) {
  await ensureDefaultAggregatorSources();
  return prisma.aggregatorSource.findMany({
    where: options.enabledOnly ? { enabled: true } : undefined,
    orderBy: { createdAt: "asc" },
    take: MAX_AGGREGATOR_SOURCES
  });
}

type FeedItem = {
  sourceName: string;
  title: string;
  link: string;
  snippet: string;
  // High-confidence media (enclosure, or the largest media:content variant): trusted as-is.
  mediaUrl?: string | null;
  // Low-confidence media (media:thumbnail, inline <img>): RSS thumbnails are explicitly small
  // preview images, so this is only used if the article page itself has no og:image/og:video.
  fallbackMediaUrl?: string | null;
};

type RawFeedItem = {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: unknown;
  mediaThumbnail?: unknown;
  contentEncoded?: string;
  "content:encoded"?: string;
} & Record<string, unknown>;

const STOPWORDS = new Set([
  "va",
  "bilan",
  "uchun",
  "haqida",
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "to",
  "for",
  "is",
  "are",
  "and",
  "after",
  "over"
]);

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9'\s]/gi, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// The cheap word-overlap check above catches near-identical headlines but misses the same
// story worded very differently across sources/languages. One batched OpenAI call over just
// the candidate titles (not full articles) groups genuine semantic duplicates cheaply -- far
// less costly than a pairwise comparison, and than running the full summarize+categorize call
// on every duplicate.
async function aiGroupDuplicates(items: FeedItem[]): Promise<number[][]> {
  if (!client || items.length < 2) return items.map((_, index) => [index]);

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are given a numbered list of news headlines from different outlets, possibly in different languages " +
            "(Uzbek, Russian, English). Group the indices whose headlines describe the SAME real-world news story or " +
            "event, even if worded completely differently or translated. Every index from 0 to N-1 must appear in " +
            'exactly one group. Respond ONLY with strict JSON: {"groups": number[][]}.'
        },
        {
          role: "user",
          content: JSON.stringify(items.map((item, index) => ({ index, source: item.sourceName, title: item.title })))
        }
      ]
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("Bo'sh javob");
    const parsed = JSON.parse(text) as { groups: number[][] };

    const seen = new Set<number>();
    const validGroups: number[][] = [];
    for (const group of parsed.groups ?? []) {
      const filtered = (group ?? []).filter((index) => Number.isInteger(index) && index >= 0 && index < items.length && !seen.has(index));
      filtered.forEach((index) => seen.add(index));
      if (filtered.length) validGroups.push(filtered);
    }
    for (let index = 0; index < items.length; index += 1) {
      if (!seen.has(index)) validGroups.push([index]);
    }
    return validGroups;
  } catch (error) {
    console.error("[aggregator] AI dublikat guruhlash ishlamadi, har biri alohida ko'riladi:", error instanceof Error ? error.message : error);
    return items.map((_, index) => [index]);
  }
}

async function fetchSource(source: NewsSource): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    // Route the feed fetch through safeFetch (SSRF-guarded, redirect-revalidated) instead of
    // parser.parseURL, which would fetch the editor-supplied URL directly with no host checks.
    const response = await safeFetch(source.feedUrl, {
      signal: controller.signal,
      headers: { "user-agent": "JahonXabarlariBot/1.0 (+https://jahonxabarlari.uz)" }
    });
    if (!response.ok) return [];
    const feed = await parser.parseString(await readTextResponse(response, 2_000_000));
    return (feed.items ?? [])
      .filter((item): item is typeof item & { title: string; link: string } => Boolean(item.title && item.link))
      .slice(0, 20)
      .map((item) => ({
        sourceName: source.name,
        title: item.title.trim(),
        link: item.link.trim(),
        snippet: (item.contentSnippet || item.content || item.summary || "").toString().trim().slice(0, 2000),
        mediaUrl: extractPrimaryFeedMedia(item, item.link),
        fallbackMediaUrl: extractFallbackFeedMedia(item, item.link)
      }));
  } catch (error) {
    console.error(`[aggregator] "${source.name}" feed fetch failed:`, error instanceof Error ? error.message : error);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function ensureAggregatorAuthor() {
  const existing = await prisma.user.findUnique({ where: { email: AGGREGATOR_AUTHOR_EMAIL } });
  if (existing) return existing;
  const role = await prisma.role.findFirstOrThrow({ where: { name: "SUPER_ADMIN" } });
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);
  return prisma.user.create({
    data: { name: "AI Agregator", email: AGGREGATOR_AUTHOR_EMAIL, passwordHash, roleId: role.id }
  });
}

async function uniqueArticleSlug(title: string): Promise<string> {
  const base = slugify(title, { lower: true, strict: true }) || `xabar-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.article.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function processItem(
  item: FeedItem,
  categories: { id: string; name: string }[],
  authorId: string,
  publishStatus: AggregatorPublishStatus
) {
  const completion = await client!.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a news editor for an Uzbek news portal called Jahon Xabarlari. Given a news item's title and " +
          "snippet (possibly in English or Russian), write an ORIGINAL Uzbek-language news brief in LATIN SCRIPT. " +
          "Use 5-8 complete sentences, preserve every name, number and attribution from the source, and never invent " +
          "a fact that is not present in the supplied text. Choose exactly one category and 2-6 concise Uzbek tags. " +
          "Set confidence from 0 to 1 based on whether the supplied source text contains enough facts for a reliable " +
          "brief. Respond ONLY with strict JSON: {\"title\": string, \"content\": string, \"category\": string, " +
          "\"isBreaking\": boolean, \"confidence\": number, \"tags\": string[]}."
      },
      {
        role: "user",
        content: JSON.stringify({
          sourceTitle: item.title,
          sourceSnippet: item.snippet,
          sourceName: item.sourceName,
          availableCategories: categories.map((c) => c.name)
        })
      }
    ]
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("AI javob bermadi");
  const parsed = z
    .object({
      title: z.string().trim().min(3).max(220),
      content: z.string().trim().min(20).max(20_000),
      category: z.string().trim().min(1).max(100),
      isBreaking: z.boolean().optional(),
      confidence: z.number().min(0).max(1).optional(),
      tags: z.array(z.string()).max(12).optional()
    })
    .parse(JSON.parse(text));

  const category = categories.find((c) => c.name.toLowerCase() === parsed.category?.toLowerCase()) ?? categories[0];
  const summary = parsed.content.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 220);
  const slug = await uniqueArticleSlug(parsed.title);
  const mainImage = await resolveArticleMedia(item);
  const quality = inspectArticleQuality({
    title: parsed.title,
    content: parsed.content,
    sourceUrl: item.link,
    mainImage,
    confidence: parsed.confidence
  });
  const status = publishStatus;
  const tagNames = normalizeArticleTags(parsed.tags).filter((name) => slugify(name, { lower: true, strict: true }));

  const article = await prisma.article.create({
    data: {
      title: parsed.title,
      slug,
      summary,
      content: parsed.content,
      seoTitle: buildSeoTitle(parsed.title),
      seoDescription: buildSeoDescription(null, summary),
      categoryId: category.id,
      authorId,
      status,
      isBreaking: Boolean(parsed.isBreaking),
      mainImage,
      sourceName: item.sourceName,
      sourceUrl: item.link,
      publishedAt: status === "PUBLISHED" ? new Date() : null
    }
  });

  if (tagNames.length) {
    const tags = await Promise.all(
      tagNames.map((name) => {
        const tagSlug = slugify(name, { lower: true, strict: true });
        return prisma.tag.upsert({ where: { slug: tagSlug }, update: { name }, create: { name, slug: tagSlug } });
      })
    );
    await prisma.articleTag.createMany({
      data: tags.map((tag) => ({ articleId: article.id, tagId: tag.id })),
      skipDuplicates: true
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: authorId,
      action: "ARTICLE_AGGREGATED",
      entity: "Article",
      entityId: article.id,
      metadata: {
        sourceName: item.sourceName,
        sourceUrl: item.link,
        requestedStatus: publishStatus,
        finalStatus: status,
        confidence: parsed.confidence ?? null,
        qualityScore: quality.score,
        qualityIssues: quality.issues,
        tags: tagNames
      }
    }
  });

  queueTranslations(article);
  queueArticlePush(article);
}

let running = false;

export type AggregatorRunOptions = {
  // Bypasses the NEWS_AGGREGATOR_ENABLED gate for a single explicit, manually-triggered run
  // (e.g. a one-time backfill) without switching on the permanent recurring schedule.
  force?: boolean;
  // Overrides the default per-cycle cap on how many items go through the AI pipeline.
  maxPerCycle?: number;
};

export type AggregatorRunResult = { published: number; skipped?: "already_running" | "disabled" | "not_configured" };

export async function runAggregatorCycle(options: AggregatorRunOptions = {}): Promise<AggregatorRunResult> {
  if (running) return { published: 0, skipped: "already_running" };
  if (!options.force && !env.NEWS_AGGREGATOR_ENABLED) return { published: 0, skipped: "disabled" };
  if (!client) {
    console.warn("[aggregator] OPENAI_API_KEY sozlanmagan, sikl o'tkazib yuborildi");
    return { published: 0, skipped: "not_configured" };
  }

  running = true;
  try {
    const result = await withRedisLock("lock:news-aggregator", 30 * 60 * 1000, async () => {
    const [categories, publishStatus] = await Promise.all([prisma.category.findMany(), getAggregatorPublishStatus()]);
    if (!categories.length) return { published: 0 };

    const author = await ensureAggregatorAuthor();
    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const recentArticles = await prisma.article.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5_000,
      select: { title: true }
    });
    const seenTokens = recentArticles.map((item) => tokenize(item.title));

    const sources = await getAggregatorSources({ enabledOnly: true });
    const batches: FeedItem[][] = [];
    for (let start = 0; start < sources.length; start += SOURCE_FETCH_CONCURRENCY) {
      const chunk = await Promise.all(sources.slice(start, start + SOURCE_FETCH_CONCURRENCY).map(fetchSource));
      batches.push(...chunk);
    }
    const candidates = batches.flat();
    const sourceUrls = [...new Set(candidates.map((item) => item.link))];
    const existingRows = sourceUrls.length
      ? await prisma.article.findMany({ where: { sourceUrl: { in: sourceUrls } }, select: { sourceUrl: true } })
      : [];
    const existingUrls = new Set(existingRows.map((item) => item.sourceUrl).filter(Boolean));

    // Pass 1: cheap filter -- drop items already ingested (by URL) or an obvious word-overlap
    // match against something recently published or already accepted earlier in this loop.
    const survivors: FeedItem[] = [];
    for (const item of candidates) {
      if (existingUrls.has(item.link)) continue;

      const tokens = tokenize(item.title);
      if (seenTokens.some((other) => similarity(tokens, other) >= DUPLICATE_THRESHOLD)) continue;
      seenTokens.push(tokens);
      survivors.push(item);
    }

    // Cap how many go through the (paid, slower) AI dedup + rewrite pipeline per cycle so a
    // large first run or a burst across many sources can't blow up cost/latency in one go --
    // anything left over simply gets picked up on the next cycle since it's still unpublished.
    const MAX_PER_CYCLE = Math.min(Math.max(options.maxPerCycle ?? 40, 1), 100);
    const batch = survivors.slice(0, MAX_PER_CYCLE);

    // Pass 2: semantic dedup via AI across the surviving candidates -- catches same-story
    // items worded too differently for the word-overlap check to have caught.
    const groups = await aiGroupDuplicates(batch);
    const deduped = groups.map((group) => batch[group[0]]);

    let published = 0;
    for (const item of deduped) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await processItem(item, categories, author.id, publishStatus);
        published += 1;
      } catch (error) {
        console.error(`[aggregator] "${item.title}" ni qayta ishlab bo'lmadi:`, error instanceof Error ? error.message : error);
      }
    }

    if (published > 0) console.log(`[aggregator] ${published} ta yangi maqola nashr qilindi`);
    return { published };
    });
    return result ?? { published: 0, skipped: "already_running" };
  } finally {
    running = false;
  }
}
