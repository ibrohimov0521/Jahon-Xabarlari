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
  shortDescription: string | null;
  mainImage: string | null;
  gallery: string[];
  sourceName: string | null;
  status: ArticleStatus;
  publishedAt: Date | null;
  telegramSentAt: Date | null;
  deletedAt: Date | null;
  category: { name: string };
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

// Aggregated content can contain source/CTA links. Telegram receives only clean news text;
// the fixed channel link below stays with every forward or repost.
export function cleanTelegramText(value: string) {
  return value
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

export function buildTelegramChannelPost(article: Pick<ChannelArticle, "title" | "summary" | "shortDescription" | "sourceName" | "category">) {
  const excerpt = cleanTelegramText(article.shortDescription || article.summary).slice(0, 700);
  const source = article.sourceName ? `\n\n<i>Manba: ${escapeHtml(cleanTelegramText(article.sourceName))}</i>` : "";
  return [
    `<b>${escapeHtml(cleanTelegramText(article.title))}</b>`,
    `<i>${escapeHtml(article.category.name)}</i>`,
    excerpt ? escapeHtml(excerpt) : "",
    source,
    `<a href="https://t.me/BESTTeam_uz">@BESTTeam_uz</a>`
  ]
    .filter(Boolean)
    .join("\n\n");
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

async function postToChannel(article: ChannelArticle) {
  const caption = buildTelegramChannelPost(article);
  const media = [article.mainImage, ...article.gallery]
    .filter((item): item is string => Boolean(item))
    .map(toExternalUrl)
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(0, 10);

  // Telegram can reject a remote image/video for size or codec reasons. Fall back to text so
  // a news item never disappears just because its media source is unavailable.
  try {
    if (media.length > 1) {
      await telegramRequest("sendMediaGroup", {
        chat_id: channel,
        media: media.map((url, index) => ({
          type: isVideo(url) ? "video" : "photo",
          media: url,
          ...(index === 0 ? { caption, parse_mode: "HTML" } : {})
        }))
      });
      return;
    }
    if (media[0]) {
      await telegramRequest(isVideo(media[0]) ? "sendVideo" : "sendPhoto", {
        chat_id: channel,
        [isVideo(media[0]) ? "video" : "photo"]: media[0],
        caption,
        parse_mode: "HTML"
      });
      return;
    }
  } catch (error) {
    console.warn(`[telegram-channel] ${article.slug} media yuborilmadi, matnli post yuboriladi:`, error);
  }

  await telegramRequest("sendMessage", {
    chat_id: channel,
    text: caption,
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
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
    include: { category: { select: { name: true } } }
  });
  if (!article || article.status !== "PUBLISHED" || article.deletedAt || article.telegramSentAt) return;

  await postToChannel(article);
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
