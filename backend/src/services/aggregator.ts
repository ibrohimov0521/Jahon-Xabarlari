import Anthropic from "@anthropic-ai/sdk";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import Parser from "rss-parser";
import slugify from "slugify";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { queueTranslations } from "./translate.js";

const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
const MODEL = "claude-haiku-4-5-20251001";
const parser = new Parser({ timeout: 15_000 });
const AGGREGATOR_AUTHOR_EMAIL = "aggregator@jahonxabarlari.uz";
const DUPLICATE_THRESHOLD = 0.4;
const DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;

export type NewsSource = { name: string; feedUrl: string };

// Reuters and AP are intentionally excluded: neither offers a public RSS feed anymore (both
// moved to paid-API-only access years ago), so there's no free/legal way to pull their content
// here. Daryo.uz and Qalampir.uz don't have a discoverable feed either -- update feedUrl below
// once you have the real one for each.
export const NEWS_SOURCES: NewsSource[] = [
  { name: "Kun.uz", feedUrl: "https://kun.uz/news/rss" },
  { name: "Gazeta.uz", feedUrl: "https://www.gazeta.uz/en/rss/" },
  { name: "Daryo.uz", feedUrl: "https://daryo.uz/rss" },
  { name: "Qalampir.uz", feedUrl: "https://qalampir.uz/rss" },
  { name: "BBC", feedUrl: "http://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "The Verge", feedUrl: "https://www.theverge.com/rss/index.xml" },
  { name: "TechCrunch", feedUrl: "https://techcrunch.com/feed/" }
];

type FeedItem = {
  sourceName: string;
  title: string;
  link: string;
  snippet: string;
};

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
        snippet: (item.contentSnippet || item.content || item.summary || "").toString().trim().slice(0, 2000)
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
  const message = await client!.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system:
      "You are a news editor for an Uzbek news portal called Jahon Xabarlari. Given a news item's title and " +
      "snippet (possibly in English or Russian), write an ORIGINAL Uzbek-language news brief based on it: a " +
      "punchy title, and a 3-5 sentence body covering the key facts in your own words (do not translate " +
      "word-for-word). Then choose exactly one category from availableCategories that best fits. Respond ONLY " +
      "with strict JSON: {\"title\": string, \"content\": string, \"category\": string, \"isBreaking\": boolean}. " +
      "No markdown, no commentary.",
    messages: [
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

  const block = message.content.find((entry) => entry.type === "text");
  if (!block || block.type !== "text") throw new Error("AI javob bermadi");
  const parsed = JSON.parse(block.text) as { title: string; content: string; category: string; isBreaking?: boolean };

  const category = categories.find((c) => c.name.toLowerCase() === parsed.category?.toLowerCase()) ?? categories[0];
  const summary = parsed.content.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 220);
  const slug = await uniqueArticleSlug(parsed.title);
  const status = env.NEWS_AGGREGATOR_STATUS;

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

export async function runAggregatorCycle(): Promise<void> {
  if (running) return;
  if (!env.NEWS_AGGREGATOR_ENABLED) return;
  if (!client) {
    console.warn("[aggregator] ANTHROPIC_API_KEY sozlanmagan, sikl o'tkazib yuborildi");
    return;
  }

  running = true;
  try {
    const categories = await prisma.category.findMany();
    if (!categories.length) return;

    const author = await ensureAggregatorAuthor();
    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const recentArticles = await prisma.article.findMany({ where: { createdAt: { gte: since } }, select: { title: true } });
    const seenTokens = recentArticles.map((item) => tokenize(item.title));

    const batches = await Promise.all(NEWS_SOURCES.map(fetchSource));
    const candidates = batches.flat();

    let published = 0;
    for (const item of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await prisma.article.findUnique({ where: { sourceUrl: item.link } });
      if (existing) continue;

      const tokens = tokenize(item.title);
      if (seenTokens.some((other) => similarity(tokens, other) >= DUPLICATE_THRESHOLD)) continue;
      seenTokens.push(tokens);

      try {
        // eslint-disable-next-line no-await-in-loop
        await processItem(item, categories, author.id);
        published += 1;
      } catch (error) {
        console.error(`[aggregator] "${item.title}" ni qayta ishlab bo'lmadi:`, error instanceof Error ? error.message : error);
      }
    }

    if (published > 0) console.log(`[aggregator] ${published} ta yangi maqola nashr qilindi`);
  } finally {
    running = false;
  }
}
