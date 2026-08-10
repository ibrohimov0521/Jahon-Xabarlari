import type { ArticleStatus, InstagramFormat } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { createBullConnection, withRedisLock } from "./redis.js";
import { brandedArticleImageUrl, brandedArticleVideoUrl } from "./brand-media-url.js";

type InstagramJob = { articleId: string };
type InstagramJobName = "article";

type InstagramArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  sourceName: string | null;
  mainImage: string | null;
  status: ArticleStatus;
  publishedAt: Date | null;
  instagramEnabled: boolean;
  instagramFormat: InstagramFormat | null;
  instagramSentAt: Date | null;
  deletedAt: Date | null;
  category: { name: string; slug: string };
};

const configured = Boolean(
  env.INSTAGRAM_POSTING_ENABLED &&
  env.INSTAGRAM_ACCESS_TOKEN &&
  env.INSTAGRAM_USER_ID &&
  env.BACKEND_PUBLIC_URL
);
const graphBase = `https://graph.facebook.com/${env.INSTAGRAM_GRAPH_API_VERSION}`;

function isVideo(url: string) {
  return /\.(?:mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(url);
}

function cleanText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/)[^\s<]+/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function instagramHashtag(categorySlug: string, categoryName: string) {
  return `#${(categorySlug || categoryName).toLocaleLowerCase("uz").replace(/[^\p{L}\p{N}_]/gu, "") || "yangilik"}`;
}

// Instagram captions are intentionally short. The original article stays on the site, while
// the channel handle gives readers a clear place to continue following breaking updates.
export function buildInstagramCaption(article: Pick<InstagramArticle, "title" | "summary" | "content" | "sourceName" | "category">) {
  const title = cleanText(article.title);
  const body = cleanText(article.content || article.summary)
    .replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")
    .trim();
  const compactBody = body.length > 1_700 ? `${body.slice(0, 1_680).trimEnd()}...` : body;
  const source = article.sourceName ? `Manba: ${cleanText(article.sourceName).slice(0, 110)}` : "";
  return [title, instagramHashtag(article.category.slug, article.category.name), compactBody, source, "@BESTTeam_uz"]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2_150);
}

async function graphRequest(path: string, body: Record<string, string | boolean>) {
  const response = await fetch(`${graphBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(Object.entries(body).map(([key, value]) => [key, String(value)])).toString(),
    signal: AbortSignal.timeout(35_000)
  });
  const data = (await response.json().catch(() => null)) as { id?: string; error?: { message?: string; code?: number } } | null;
  if (!response.ok || data?.error || !data?.id) {
    throw new Error(`Instagram API: ${data?.error?.message ?? response.status}`);
  }
  return data.id;
}

async function waitForContainer(containerId: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(`${graphBase}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(env.INSTAGRAM_ACCESS_TOKEN!)}`, {
      signal: AbortSignal.timeout(25_000)
    });
    const data = (await response.json().catch(() => null)) as { status_code?: string; status?: string; error?: { message?: string } } | null;
    if (!response.ok || data?.error) throw new Error(`Instagram container: ${data?.error?.message ?? response.status}`);
    const state = data?.status_code ?? data?.status;
    if (state === "FINISHED") return;
    if (state === "ERROR" || state === "EXPIRED") throw new Error(`Instagram media tayyorlanmadi: ${state}`);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("Instagram media tayyorlanishi uchun vaqt tugadi");
}

async function findPermalink(mediaId: string) {
  const response = await fetch(`${graphBase}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(env.INSTAGRAM_ACCESS_TOKEN!)}`, {
    signal: AbortSignal.timeout(20_000)
  });
  const data = (await response.json().catch(() => null)) as { permalink?: string } | null;
  return typeof data?.permalink === "string" ? data.permalink : null;
}

async function publishArticleToInstagram(articleId: string) {
  if (!configured) return;
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { category: { select: { name: true, slug: true } } }
  });
  if (!article || article.status !== "PUBLISHED" || article.deletedAt || !article.instagramEnabled || article.instagramSentAt) return;
  if (!article.mainImage) {
    await prisma.article.update({ where: { id: article.id }, data: { instagramError: "Instagram uchun rasm yoki video biriktirilmagan" } });
    return;
  }

  try {
    const inferredFormat: InstagramFormat = isVideo(article.mainImage) ? "REEL" : "POST";
    const format = article.instagramFormat ?? inferredFormat;
    if (format === "POST" && isVideo(article.mainImage)) throw new Error("Video uchun Instagram Reel formatini tanlang");
    if (format === "REEL" && !isVideo(article.mainImage)) throw new Error("Instagram Reel uchun video kerak");

    const caption = buildInstagramCaption(article);
    const containerId = await graphRequest(`/${env.INSTAGRAM_USER_ID}/media`, {
      access_token: env.INSTAGRAM_ACCESS_TOKEN!,
      caption,
      ...(format === "POST"
        ? { image_url: brandedArticleImageUrl(article.id)! }
        : {
            media_type: "REELS",
            video_url: (() => {
              const url = brandedArticleVideoUrl(article.id);
              if (!url) throw new Error("Instagram Reel uchun media-renderer xizmatini sozlang");
              return url;
            })(),
            share_to_feed: true
          })
    });
    if (format === "REEL") await waitForContainer(containerId);
    const mediaId = await graphRequest(`/${env.INSTAGRAM_USER_ID}/media_publish`, {
      access_token: env.INSTAGRAM_ACCESS_TOKEN!,
      creation_id: containerId
    });
    const permalink = await findPermalink(mediaId).catch(() => null);
    await prisma.article.update({
      where: { id: article.id },
      data: { instagramSentAt: new Date(), instagramMediaId: mediaId, instagramUrl: permalink, instagramError: null }
    });
    console.log(`[instagram] ${article.slug} ${format} sifatida yuborildi`);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_500) : "Instagram yuborishda noma'lum xato";
    await prisma.article.update({ where: { id: article.id }, data: { instagramError: message } }).catch(() => undefined);
    throw error;
  }
}

export function queueArticleInstagramPost(article: { id: string; status: ArticleStatus; publishedAt: Date | null }) {
  if (!configured || !instagramQueue || article.status !== "PUBLISHED") return;
  const revision = article.publishedAt?.getTime() ?? Date.now();
  void instagramQueue.add("article", { articleId: article.id }, {
    jobId: `instagram-${article.id}-${revision}`,
    attempts: 5,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: 7 * 24 * 60 * 60, count: 5_000 },
    removeOnFail: { age: 14 * 24 * 60 * 60, count: 5_000 }
  }).catch((error) => console.error("[instagram] post navbatga olinmadi:", error));
}

let instagramQueue: Queue<InstagramJob, void, InstagramJobName> | null = null;
let instagramWorker: Worker<InstagramJob, void, InstagramJobName> | null = null;

if (configured) {
  instagramQueue = new Queue<InstagramJob, void, InstagramJobName>("instagram-posts", { connection: createBullConnection() });
  instagramWorker = new Worker<InstagramJob, void, InstagramJobName>(
    "instagram-posts",
    async (job) => {
      const handled = await withRedisLock(`lock:instagram:${job.data.articleId}`, 15 * 60 * 1000, async () => {
        await publishArticleToInstagram(job.data.articleId);
        return true;
      });
      if (!handled) throw new Error("Bu maqolaning Instagram posti hali ishlamoqda");
    },
    { connection: createBullConnection(), concurrency: 1 }
  );
  instagramWorker.on("failed", (job, error) => console.error(`[instagram] job ${job?.id ?? "unknown"} failed:`, error));
  instagramWorker.on("error", (error) => console.error("[instagram] worker xatosi:", error));
  instagramQueue.on("error", (error) => console.error("[instagram] queue xatosi:", error));
}

export async function closeInstagramJobs() {
  await Promise.all([instagramWorker?.close(), instagramQueue?.close()]);
}
