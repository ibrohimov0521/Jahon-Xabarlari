import type { ArticleStatus } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { createBullConnection, withRedisLock } from "./redis.js";

const configured = Boolean(
  env.TELEGRAM_CHANNEL_POSTING_ENABLED && env.TELEGRAM_CHANNEL_BOT_TOKEN && env.TELEGRAM_NEWS_CHANNEL
);
const channel = env.TELEGRAM_NEWS_CHANNEL
  ? env.TELEGRAM_NEWS_CHANNEL.startsWith("@") || env.TELEGRAM_NEWS_CHANNEL.startsWith("-100")
    ? env.TELEGRAM_NEWS_CHANNEL
    : `@${env.TELEGRAM_NEWS_CHANNEL}`
  : "";
const telegramApi = env.TELEGRAM_CHANNEL_BOT_TOKEN
  ? `https://api.telegram.org/bot${env.TELEGRAM_CHANNEL_BOT_TOKEN}`
  : "";

type ChannelJob = { articleId: string };
type ChannelJobName = "article";

type ChannelArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  sourceName: string | null;
  mainImage: string | null;
  gallery: string[];
  status: ArticleStatus;
  publishedAt: Date | null;
  telegramSentAt: Date | null;
  deletedAt: Date | null;
  category: { name: string; slug: string };
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

// Aggregated content can contain source/CTA links. Telegram receives only clean news text;
// the fixed channel link below stays with every forward or repost.
export function cleanTelegramText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/)[^\s<]+/gi, "")
    .replace(/\b(?:obuna bo'ling|kanalga qo'shiling|batafsil[^.!?]{0,80})[.!?]?/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isVideo(url: string) {
  return /\.(?:mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(url);
}

function toExternalUrl(value: string) {
  try {
    return new URL(value, env.FRONTEND_URL).toString();
  } catch {
    return value;
  }
}

function stripRepeatedHeadline(body: string, headline: string) {
  const text = body.trim();
  const paragraphEnd = text.search(/\n\s*\n/);
  if (paragraphEnd < 0) return text;

  const normalize = (value: string) => value
    .replace(/^\s*(?:[#\p{Extended_Pictographic}\p{P}\p{S}]+\s*)+/gu, "")
    .toLocaleLowerCase("uz")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const firstParagraph = normalize(text.slice(0, paragraphEnd));
  const normalizedHeadline = normalize(headline.replace(/(?:\.\.\.|\u2026)\s*$/, ""));
  if (!firstParagraph || !normalizedHeadline) return text;

  const repeated =
    firstParagraph === normalizedHeadline ||
    firstParagraph.startsWith(normalizedHeadline) ||
    normalizedHeadline.startsWith(firstParagraph);
  return repeated ? text.slice(paragraphEnd).trim() : text;
}

function completeArticleHeadline(title: string, content: string) {
  if (!/(?:\.\.\.|\u2026)\s*$/.test(title)) return title;
  const firstParagraph = cleanTelegramText(content).split(/\n\s*\n/, 1)[0]?.trim() ?? "";
  if (!firstParagraph || firstParagraph.length > 220) return title;
  const normalize = (value: string) => value
    .replace(/^\s*(?:[#\p{Extended_Pictographic}\p{P}\p{S}]+\s*)+/gu, "")
    .toLocaleLowerCase("uz")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const current = normalize(title.replace(/(?:\.\.\.|\u2026)\s*$/, ""));
  const candidate = normalize(firstParagraph);
  return current && candidate && (candidate.startsWith(current) || current.startsWith(candidate)) ? firstParagraph : title;
}

function channelHashtag(categorySlug: string, categoryName: string) {
  const raw = categorySlug || categoryName;
  const normalized = raw.toLocaleLowerCase("uz").replace(/[^\p{L}\p{N}_]/gu, "");
  return `#${normalized || "yangilik"}`;
}

function headlinePrefix(useCustomEmoji: boolean) {
  const id = env.TELEGRAM_CHANNEL_CUSTOM_EMOJI_ID;
  return useCustomEmoji && id ? `<tg-emoji emoji-id="${id}">\u{1F4F0}</tg-emoji>` : "\u{1F4F0}";
}

type ChannelPostParts = {
  heading: string;
  body: string;
  footer: string;
};

// The channel template intentionally has only three content blocks:
// headline, topic hashtag and the full cleaned article body.
export function buildTelegramChannelPost(article: Pick<ChannelArticle, "title" | "summary" | "content" | "sourceName" | "category">, useCustomEmoji = true): ChannelPostParts {
  const title = completeArticleHeadline(cleanTelegramText(article.title), article.content || article.summary);
  const body = stripRepeatedHeadline(cleanTelegramText(article.content || article.summary), title);
  const source = article.sourceName ? cleanTelegramText(article.sourceName).slice(0, 120) : "";
  return {
    heading: `${headlinePrefix(useCustomEmoji)} <b>${escapeHtml(title)}</b>\n${channelHashtag(article.category.slug, article.category.name)}`,
    body,
    footer: [
      source ? `<i>Manba: ${escapeHtml(source)}</i>` : "",
      `\u{1F447} <a href="https://t.me/+0F9uBUV0bPc2OTM6">Eng so'nggi yangiliklarni o'tkazib yubormaslik uchun obuna bo'ling</a>`
    ]
      .filter(Boolean)
      .join("\n\n")
  };
}

function splitText(value: string, maxLength: number) {
  const parts: string[] = [];
  let remaining = value.trim();
  while (remaining.length > maxLength) {
    const boundary = Math.max(
      remaining.lastIndexOf("\n", maxLength),
      remaining.lastIndexOf(". ", maxLength),
      remaining.lastIndexOf("! ", maxLength),
      remaining.lastIndexOf("? ", maxLength),
      remaining.lastIndexOf(" ", maxLength)
    );
    const cut = boundary > Math.floor(maxLength * 0.5) ? boundary + 1 : maxLength;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

async function telegramRequest(method: string, body: Record<string, unknown>) {
  const response = await fetch(`${telegramApi}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000)
  });
  const result = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !result?.ok) {
    throw new Error(`Telegram ${method} xatosi: ${result?.description ?? response.status}`);
  }
}

async function sendRemainingText(parts: string[], footer: string) {
  const chunks = parts.length ? parts : [""];
  for (const [index, part] of chunks.entries()) {
    const last = index === chunks.length - 1;
    await telegramRequest("sendMessage", {
      chat_id: channel,
      text: `${escapeHtml(part)}${last ? `\n\n${footer}` : ""}`.trim(),
      parse_mode: "HTML",
      disable_web_page_preview: true
    });
  }
}

async function sendTextPost(post: ChannelPostParts) {
  const chunks = splitText(post.body, 3_000);
  const messages = chunks.length ? chunks : [""];
  for (const [index, chunk] of messages.entries()) {
    const first = index === 0;
    const last = index === messages.length - 1;
    await telegramRequest("sendMessage", {
      chat_id: channel,
      text: `${first ? `${post.heading}\n\n` : ""}${escapeHtml(chunk)}${last ? `\n\n${post.footer}` : ""}`.trim(),
      parse_mode: "HTML",
      disable_web_page_preview: true
    });
  }
}

async function postToChannel(article: ChannelArticle, useCustomEmoji = true) {
  const post = buildTelegramChannelPost(article, useCustomEmoji);
  const captionChunks = splitText(post.body, 650);
  const firstText = captionChunks.shift() ?? "";
  const captionBase = `${post.heading}${firstText ? `\n\n${escapeHtml(firstText)}` : ""}`;
  const media = [article.mainImage, ...article.gallery]
    .filter((item): item is string => Boolean(item))
    .map(toExternalUrl)
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(0, 10);

  // Telegram can reject remote media for size/codec reasons. A clean text post still goes out.
  if (media.length > 1) {
    try {
      const caption = `${captionBase}${captionChunks.length ? "" : `\n\n${post.footer}`}`;
      await telegramRequest("sendMediaGroup", {
        chat_id: channel,
        media: media.map((url, index) => ({
          type: isVideo(url) ? "video" : "photo",
          media: url,
          ...(index === 0 ? { caption, parse_mode: "HTML" } : {})
        }))
      });
      if (captionChunks.length) await sendRemainingText(captionChunks, post.footer);
      return;
    } catch (error) {
      console.warn(`[telegram-channel] ${article.slug} media yuborilmadi, matnli post yuboriladi:`, error);
    }
  } else if (media[0]) {
    try {
      const caption = `${captionBase}${captionChunks.length ? "" : `\n\n${post.footer}`}`;
      await telegramRequest(isVideo(media[0]) ? "sendVideo" : "sendPhoto", {
        chat_id: channel,
        [isVideo(media[0]) ? "video" : "photo"]: media[0],
        caption,
        parse_mode: "HTML"
      });
      if (captionChunks.length) await sendRemainingText(captionChunks, post.footer);
      return;
    } catch (error) {
      console.warn(`[telegram-channel] ${article.slug} media yuborilmadi, matnli post yuboriladi:`, error);
    }
  }

  await sendTextPost(post);
}

export function queueArticleTelegramPost(article: { id: string; status: ArticleStatus; publishedAt: Date | null }) {
  if (!configured || !channelQueue || article.status !== "PUBLISHED") return;
  const revision = article.publishedAt?.getTime() ?? Date.now();
  void channelQueue
    .add("article", { articleId: article.id }, {
      jobId: `telegram-channel-${article.id}-${revision}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 5_000 },
      removeOnFail: { age: 14 * 24 * 60 * 60, count: 5_000 }
    })
    .catch((error) => console.error("[telegram-channel] post navbatga olinmadi:", error));
}

async function sendArticleToChannel(articleId: string) {
  if (!configured) return;
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { category: { select: { name: true, slug: true } } }
  });
  if (!article || article.status !== "PUBLISHED" || article.deletedAt || article.telegramSentAt) return;

  try {
    await postToChannel(article);
  } catch (error) {
    // A custom emoji is a visual extra. Never lose a news post when Telegram rejects it.
    if (!env.TELEGRAM_CHANNEL_CUSTOM_EMOJI_ID) throw error;
    console.warn(`[telegram-channel] ${article.slug} custom emoji ishlamadi, oddiy emoji bilan qayta uriniladi:`, error);
    await postToChannel(article, false);
  }
  await prisma.article.update({ where: { id: article.id }, data: { telegramSentAt: new Date() } });
  console.log(`[telegram-channel] ${article.slug} kanalga yuborildi`);
}

let channelQueue: Queue<ChannelJob, void, ChannelJobName> | null = null;
let channelWorker: Worker<ChannelJob, void, ChannelJobName> | null = null;

if (configured) {
  channelQueue = new Queue<ChannelJob, void, ChannelJobName>("telegram-channel-posts", { connection: createBullConnection() });
  channelWorker = new Worker<ChannelJob, void, ChannelJobName>(
    "telegram-channel-posts",
    async (job) => {
      const handled = await withRedisLock(`lock:telegram-channel:${job.data.articleId}`, 10 * 60 * 1000, async () => {
        await sendArticleToChannel(job.data.articleId);
        return true;
      });
      if (!handled) throw new Error("Bu maqola uchun Telegram kanal posti hali ishlamoqda");
    },
    { connection: createBullConnection(), concurrency: 1 }
  );

  channelWorker.on("failed", (job, error) => console.error(`[telegram-channel] job ${job?.id ?? "unknown"} failed:`, error));
  channelWorker.on("error", (error) => console.error("[telegram-channel] worker xatosi:", error));
  channelQueue.on("error", (error) => console.error("[telegram-channel] queue xatosi:", error));
}

export async function closeTelegramChannelJobs() {
  await Promise.all([channelWorker?.close(), channelQueue?.close()]);
}
