import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import OpenAI from "openai";
import Parser from "rss-parser";
import slugify from "slugify";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { queueTranslations } from "./translate.js";

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

export type NewsSource = { name: string; feedUrl: string };

// Every URL below was verified with a live rss-parser fetch before being added here.
// Reuters and AP are intentionally excluded: neither offers a public RSS feed anymore (both
// moved to paid-API-only access years ago), so there's no free/legal way to pull their content.
// Daryo.uz and Qalampir.uz don't have a discoverable feed (tried /rss, /feed, /rss.xml -- all
// 404 or malformed) -- add them here once you have the real feed URL for each.
export const NEWS_SOURCES: NewsSource[] = [
  // O'zbekiston
  { name: "Kun.uz", feedUrl: "https://kun.uz/news/rss" },
  { name: "Gazeta.uz", feedUrl: "https://www.gazeta.uz/en/rss/" },
  { name: "UzA", feedUrl: "https://uza.uz/uz/rss" },
  { name: "Podrobno.uz", feedUrl: "https://podrobno.uz/rss/" },
  { name: "Anhor.uz", feedUrl: "https://anhor.uz/rss" },
  { name: "Sputnik O'zbekiston", feedUrl: "https://uz.sputniknews.ru/export/rss2/archive/index.xml" },
  { name: "Xabar.uz", feedUrl: "https://xabar.uz/rss" },
  // Dunyo
  { name: "BBC World", feedUrl: "http://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Al Jazeera", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "NYT World", feedUrl: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
  { name: "CNN Top Stories", feedUrl: "http://rss.cnn.com/rss/cnn_topstories.rss" },
  { name: "The Guardian World", feedUrl: "https://www.theguardian.com/world/rss" },
  { name: "DW", feedUrl: "https://rss.dw.com/rdf/rss-en-all" },
  // Sport
  { name: "BBC Sport", feedUrl: "https://feeds.bbci.co.uk/sport/rss.xml?edition=int" },
  { name: "ESPN", feedUrl: "https://www.espn.com/espn/rss/news" },
  { name: "Marca", feedUrl: "https://e00-marca.uecdn.es/rss/en/football.xml" },
  // Texnologiya
  { name: "The Verge", feedUrl: "https://www.theverge.com/rss/index.xml" },
  { name: "TechCrunch", feedUrl: "https://techcrunch.com/feed/" },
  { name: "Ars Technica", feedUrl: "https://feeds.arstechnica.com/arstechnica/index" },
  { name: "Engadget", feedUrl: "https://www.engadget.com/rss.xml" },
  { name: "Wired", feedUrl: "https://www.wired.com/feed/rss" },
  { name: "VentureBeat", feedUrl: "https://venturebeat.com/feed/" },
  { name: "MIT Technology Review", feedUrl: "https://www.technologyreview.com/feed/" },
  { name: "BBC Technology", feedUrl: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  // Iqtisodiyot
  { name: "BBC Business", feedUrl: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { name: "CNBC", feedUrl: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { name: "Investing.com", feedUrl: "https://www.investing.com/rss/news.rss" },
  { name: "Yahoo Finance", feedUrl: "https://finance.yahoo.com/news/rssindex" }
];

type FeedItem = {
  sourceName: string;
  title: string;
  link: string;
  snippet: string;
  mediaUrl?: string | null;
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

function extractHtmlMedia(html: string | undefined, baseUrl: string) {
  if (!html) return null;
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  const videoMatch = html.match(/<source[^>]+src=["']([^"']+)["']/i) ?? html.match(/<video[^>]+src=["']([^"']+)["']/i);
  return absolutizeMediaUrl(videoMatch?.[1] ?? imgMatch?.[1] ?? null, baseUrl);
}

function extractFeedMedia(item: RawFeedItem, baseUrl: string) {
  const candidates = [
    firstMedia(item.enclosure),
    firstMedia(item.mediaContent),
    firstMedia(item.mediaThumbnail),
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

async function resolveArticleMedia(item: FeedItem) {
  if (item.mediaUrl) return item.mediaUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(item.link, {
      signal: controller.signal,
      headers: {
        "user-agent": "JahonXabarlariBot/1.0 (+https://www.jahonxabarlari.uz)"
      }
    });
    if (!response.ok) return null;
    const html = await response.text();
    return extractMetaMedia(html.slice(0, 250_000), item.link);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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
  try {
    const feed = await parser.parseURL(source.feedUrl);
    return (feed.items ?? [])
      .filter((item): item is typeof item & { title: string; link: string } => Boolean(item.title && item.link))
      .slice(0, 20)
      .map((item) => ({
        sourceName: source.name,
        title: item.title.trim(),
        link: item.link.trim(),
        snippet: (item.contentSnippet || item.content || item.summary || "").toString().trim().slice(0, 2000),
        mediaUrl: extractFeedMedia(item, item.link)
      }));
  } catch (error) {
    console.error(`[aggregator] "${source.name}" feed fetch failed:`, error instanceof Error ? error.message : error);
    return [];
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

export async function runAggregatorCycle(options: AggregatorRunOptions = {}): Promise<{ published: number }> {
  if (running) return { published: 0 };
  if (!options.force && !env.NEWS_AGGREGATOR_ENABLED) return { published: 0 };
  if (!client) {
    console.warn("[aggregator] OPENAI_API_KEY sozlanmagan, sikl o'tkazib yuborildi");
    return { published: 0 };
  }

  running = true;
  try {
    const categories = await prisma.category.findMany();
    if (!categories.length) return { published: 0 };

    const author = await ensureAggregatorAuthor();
    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const recentArticles = await prisma.article.findMany({ where: { createdAt: { gte: since } }, select: { title: true } });
    const seenTokens = recentArticles.map((item) => tokenize(item.title));

    const batches = await Promise.all(NEWS_SOURCES.map(fetchSource));
    const candidates = batches.flat();

    // Pass 1: cheap filter -- drop items already ingested (by URL) or an obvious word-overlap
    // match against something recently published or already accepted earlier in this loop.
    const survivors: FeedItem[] = [];
    for (const item of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await prisma.article.findUnique({ where: { sourceUrl: item.link } });
      if (existing) continue;

      const tokens = tokenize(item.title);
      if (seenTokens.some((other) => similarity(tokens, other) >= DUPLICATE_THRESHOLD)) continue;
      seenTokens.push(tokens);
      survivors.push(item);
    }

    // Cap how many go through the (paid, slower) AI dedup + rewrite pipeline per cycle so a
    // large first run or a burst across many sources can't blow up cost/latency in one go --
    // anything left over simply gets picked up on the next cycle since it's still unpublished.
    const MAX_PER_CYCLE = options.maxPerCycle ?? 40;
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
  } finally {
    running = false;
  }
}
