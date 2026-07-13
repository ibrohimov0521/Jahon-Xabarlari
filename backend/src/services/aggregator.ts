import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import OpenAI from "openai";
import Parser from "rss-parser";
import slugify from "slugify";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { NEWS_SOURCES, type NewsSource } from "./aggregator-sources.js";
import { safeFetch } from "./net-guard.js";
import { queueTranslations } from "./translate.js";
import { withRedisLock } from "./redis.js";

export { NEWS_SOURCES, type NewsSource };

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
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
    orderBy: { createdAt: "asc" }
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

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const attrs = record.$ && typeof record.$ === "object" ? (record.$ as Record<string, unknown>) : {};
    return firstString(record.url ?? attrs.url ?? record.href ?? attrs.href);
  }
  return null;
}

function absolutizeMediaUrl(url: string | null, baseUrl: string) {
  if (!url) return null;
  const decoded = decodeHtml(url.trim());
  if (!/^https?:\/\//i.test(decoded) && !decoded.startsWith("//") && !decoded.startsWith("/")) return null;
  try {
    return new URL(decoded.startsWith("//") ? `https:${decoded}` : decoded, baseUrl).toString();
  } catch {
    return null;
  }
}

function isHttpUrl(url: string | null) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function looksLikeMedia(url: string | null, mimeType?: string | null) {
  return Boolean(
    isHttpUrl(url) &&
      ((mimeType && /^(image|video)\//i.test(mimeType)) || /\.(jpe?g|png|webp|gif|avif|mp4|webm|mov)(?:[?#].*)?$/i.test(url!))
  );
}

function firstMedia(value: unknown): { url: string | null; type: string | null } {
  if (typeof value === "string" && value.trim()) return { url: value.trim(), type: null };
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstMedia(item);
      if (found.url) return found;
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const attrs = record.$ && typeof record.$ === "object" ? (record.$ as Record<string, unknown>) : {};
    return {
      url: firstString(record.url ?? attrs.url ?? record.href ?? attrs.href),
      type: firstString(record.type ?? attrs.type ?? record.medium ?? attrs.medium)
    };
  }
  return { url: null, type: null };
}

function mediaScore(entry: unknown): number {
  if (!entry || typeof entry !== "object") return 0;
  const record = entry as Record<string, unknown>;
  const attrs = record.$ && typeof record.$ === "object" ? (record.$ as Record<string, unknown>) : record;
  const width = Number(attrs.width) || 0;
  const height = Number(attrs.height) || 0;
  const fileSize = Number(attrs.fileSize) || 0;
  const url = firstString(attrs.url ?? attrs.href) ?? "";
  const baseScore = width && height ? width * height : fileSize;
  const thumbnailPenalty = /(thumb|thumbnail|small|150x|200x|300x|_s\.|\/s\d{2,3}\/)/i.test(url) ? 0.25 : 1;
  return baseScore * thumbnailPenalty;
}

// media:content / media:thumbnail often list several resolution variants for the same item.
// Picking the first one (as opposed to the largest) is how a 150x150 thumbnail can end up as
// mainImage even when a proper full-size version was right there in the same array.
function bestMedia(value: unknown): { url: string | null; type: string | null } {
  if (!Array.isArray(value)) return firstMedia(value);
  let best: { url: string | null; type: string | null } = { url: null, type: null };
  let bestScore = -1;
  for (const entry of value) {
    const found = firstMedia(entry);
    if (!found.url) continue;
    const score = mediaScore(entry);
    if (score > bestScore) {
      best = found;
      bestScore = score;
    }
  }
  return best;
}

function extractHtmlMedia(html: string | undefined, baseUrl: string) {
  if (!html) return null;
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  const videoMatch = html.match(/<source[^>]+src=["']([^"']+)["']/i) ?? html.match(/<video[^>]+src=["']([^"']+)["']/i);
  return absolutizeMediaUrl(videoMatch?.[1] ?? imgMatch?.[1] ?? null, baseUrl);
}

// High-confidence media only: an enclosure or the largest media:content variant. Both are
// normally full-size images/video meant to represent the article, safe to trust as-is.
function extractPrimaryFeedMedia(item: RawFeedItem, baseUrl: string) {
  const candidates = [firstMedia(item.enclosure), bestMedia(item.mediaContent)];
  for (const candidate of candidates) {
    const url = absolutizeMediaUrl(candidate.url, baseUrl);
    if (looksLikeMedia(url, candidate.type)) return url;
  }
  return null;
}

// Low-confidence media: media:thumbnail is explicitly a small preview image, and a scraped
// inline <img> from the feed's HTML body is often a logo or unrelated icon. Only used as a
// last resort when neither the feed nor the article page itself yields anything better.
function extractFallbackFeedMedia(item: RawFeedItem, baseUrl: string) {
  const candidates = [
    bestMedia(item.mediaThumbnail),
    { url: extractHtmlMedia(item.contentEncoded ?? item["content:encoded"] ?? item.content, baseUrl), type: null }
  ];
  for (const candidate of candidates) {
    const url = absolutizeMediaUrl(candidate.url, baseUrl);
    if (looksLikeMedia(url, candidate.type)) return url;
  }
  return null;
}

function extractMetaMedia(html: string, baseUrl: string) {
  const patterns = [
    /<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url|:url)?["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url|:url)?["']/i
  ];
  for (const pattern of patterns) {
    const url = absolutizeMediaUrl(html.match(pattern)?.[1] ?? null, baseUrl);
    if (isHttpUrl(url)) return url;
  }
  const inline = extractHtmlMedia(html, baseUrl);
  return looksLikeMedia(inline) ? inline : null;
}

async function fetchPageMedia(link: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await safeFetch(link, {
      signal: controller.signal,
      headers: {
        "user-agent": "JahonXabarlariBot/1.0 (+https://www.jahonxabarlari.uz)"
      }
    });
    if (!response.ok) return null;
    const html = await response.text();
    return extractMetaMedia(html.slice(0, 250_000), link);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Priority: (1) enclosure / largest media:content -- already known-good, full-size. (2) the
// article page's own og:image/og:video -- a "share card" image, reliably full-size/high-res
// since it's designed to look good large. (3) RSS media:thumbnail / an inline <img> scraped
// from the feed body -- both are explicitly small previews, only used if nothing better exists.
async function resolveArticleMedia(item: FeedItem) {
  if (item.mediaUrl) return item.mediaUrl;
  const pageMedia = await fetchPageMedia(item.link);
  if (pageMedia) return pageMedia;
  return item.fallbackMediaUrl ?? null;
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
      headers: { "user-agent": "JahonXabarlariBot/1.0 (+https://www.jahonxabarlari.uz)" }
    });
    if (!response.ok) return [];
    const feed = await parser.parseString(await response.text());
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

async function processItem(item: FeedItem, categories: { id: string; name: string }[], authorId: string) {
  const completion = await client!.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a news editor for an Uzbek news portal called Jahon Xabarlari. Given a news item's title and " +
          "snippet (possibly in English or Russian), write an ORIGINAL Uzbek-language news brief based on it: a " +
          "punchy title, and a 3-5 sentence body covering the key facts in your own words (do not translate " +
          "word-for-word). Then choose exactly one category from availableCategories that best fits. Respond ONLY " +
          "with strict JSON: {\"title\": string, \"content\": string, \"category\": string, \"isBreaking\": boolean}."
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
  const parsed = JSON.parse(text) as { title: string; content: string; category: string; isBreaking?: boolean };

  const category = categories.find((c) => c.name.toLowerCase() === parsed.category?.toLowerCase()) ?? categories[0];
  const summary = parsed.content.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 220);
  const slug = await uniqueArticleSlug(parsed.title);
  const status = env.NEWS_AGGREGATOR_STATUS;
  const mainImage = await resolveArticleMedia(item);

  const article = await prisma.article.create({
    data: {
      title: parsed.title,
      slug,
      summary,
      content: parsed.content,
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

  await prisma.auditLog.create({
    data: {
      userId: authorId,
      action: "ARTICLE_AGGREGATED",
      entity: "Article",
      entityId: article.id,
      metadata: { sourceName: item.sourceName, sourceUrl: item.link }
    }
  });

  queueTranslations(article);
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
    const categories = await prisma.category.findMany();
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
    const batches = await Promise.all(sources.map(fetchSource));
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
        await processItem(item, categories, author.id);
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
