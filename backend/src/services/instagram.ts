import type { ArticleStatus, InstagramFormat } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { Queue, Worker } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { createBullConnection, withRedisLock } from "./redis.js";
import { brandedArticleImageUrl, brandedArticleVideoUrl, instagramArticleCoverUrl } from "./brand-media-url.js";

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
// The Meta app is configured with "API setup with Instagram Login". Tokens from
// that product are accepted by graph.instagram.com, while Facebook Login keeps
// using graph.facebook.com for older Page-connected setups.
const graphHost = env.INSTAGRAM_API_MODE === "facebook_login" ? "https://graph.facebook.com" : "https://graph.instagram.com";
const graphBase = `${graphHost}/${env.INSTAGRAM_GRAPH_API_VERSION}`;

type InstagramGraphError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
};

type InstagramConnectionResult = {
  ok: boolean;
  message: string;
  username?: string;
  accountType?: string;
};

export type InstagramDeliveryState = "sent" | "queued" | "failed";

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

function instagramHashtags(categorySlug: string, categoryName: string) {
  const category = (categorySlug || categoryName).toLocaleLowerCase("uz").replace(/[^\p{L}\p{N}_]/gu, "") || "yangilik";
  return [`#${category}`, "#bestteamnews", "#yangiliklar"].join(" ");
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
  return [title, instagramHashtags(article.category.slug, article.category.name), compactBody, source, "@BESTTeamNEWS"]
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
  const data = (await response.json().catch(() => null)) as { id?: string; error?: InstagramGraphError } | null;
  if (!response.ok || data?.error || !data?.id) {
    if (data?.error?.code === 190) {
      throw new Error("Instagram access token Meta tomonidan qabul qilinmadi. Token, Instagram User ID va Meta API ulanish turini tekshiring");
    }
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

function configurationMessage() {
  if (!env.INSTAGRAM_POSTING_ENABLED) return "Instagramga avtomatik yuborish Railway sozlamalarida o'chirilgan";
  if (!env.INSTAGRAM_ACCESS_TOKEN) return "INSTAGRAM_ACCESS_TOKEN kiritilmagan";
  if (!env.INSTAGRAM_USER_ID) return "INSTAGRAM_USER_ID kiritilmagan";
  if (!env.BACKEND_PUBLIC_URL?.startsWith("https://")) return "BACKEND_PUBLIC_URL public HTTPS manzil bo'lishi kerak";
  return "Instagram sozlamalari to'liq emas";
}

export async function getInstagramSettingsStatus() {
  const [sent, failed, queued, latestFailure] = await Promise.all([
    prisma.article.count({ where: { deletedAt: null, instagramSentAt: { not: null } } }),
    prisma.article.count({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        instagramEnabled: true,
        instagramSentAt: null,
        instagramError: { not: null }
      }
    }),
    prisma.article.count({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        instagramEnabled: true,
        instagramSentAt: null,
        instagramError: null
      }
    }),
    prisma.article.findFirst({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        instagramEnabled: true,
        instagramSentAt: null,
        instagramError: { not: null }
      },
      orderBy: { updatedAt: "desc" },
      select: { title: true, instagramError: true, updatedAt: true }
    })
  ]);

  return {
    enabled: env.INSTAGRAM_POSTING_ENABLED,
    ready: configured,
    apiMode: env.INSTAGRAM_API_MODE,
    apiEndpoint: graphHost,
    graphApiVersion: env.INSTAGRAM_GRAPH_API_VERSION,
    tokenConfigured: Boolean(env.INSTAGRAM_ACCESS_TOKEN),
    userIdConfigured: Boolean(env.INSTAGRAM_USER_ID),
    accountHint: env.INSTAGRAM_USER_ID ? `••••${env.INSTAGRAM_USER_ID.slice(-4)}` : null,
    publicMediaReady: Boolean(env.BACKEND_PUBLIC_URL?.startsWith("https://")),
    mediaRendererReady: Boolean(env.MEDIA_RENDERER_URL && env.MEDIA_RENDERER_SECRET),
    posts: { sent, failed, queued },
    latestFailure: latestFailure
      ? { title: latestFailure.title, message: latestFailure.instagramError, at: latestFailure.updatedAt }
      : null,
    configurationMessage: configured ? "Instagram avtomatik yuborishga tayyor" : configurationMessage()
  };
}

export async function getInstagramDeliveries(state: InstagramDeliveryState, page = 1) {
  const take = 12;
  const safePage = Math.max(1, Math.floor(page) || 1);
  const where = {
    status: "PUBLISHED" as const,
    deletedAt: null,
    instagramEnabled: true,
    ...(state === "sent"
      ? { instagramSentAt: { not: null } }
      : state === "failed"
        ? { instagramSentAt: null, instagramError: { not: null } }
        : { instagramSentAt: null, instagramError: null })
  };
  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: state === "sent" ? { instagramSentAt: "desc" } : { updatedAt: "desc" },
      skip: (safePage - 1) * take,
      take,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        mainImage: true,
        instagramFormat: true,
        instagramSentAt: true,
        instagramUrl: true,
        instagramError: true,
        updatedAt: true,
        category: { select: { name: true, slug: true } }
      }
    }),
    prisma.article.count({ where })
  ]);

  return {
    state,
    items: items.map((article) => ({
      ...article,
      previewUrl: article.mainImage && !isVideo(article.mainImage) ? instagramArticleCoverUrl(article.id) : null
    })),
    total,
    page: safePage,
    pages: Math.max(1, Math.ceil(total / take))
  };
}

export async function testInstagramConnection(): Promise<InstagramConnectionResult> {
  if (!configured) return { ok: false, message: configurationMessage() };

  try {
    const response = await fetch(
      `${graphBase}/${env.INSTAGRAM_USER_ID}?fields=id,username,account_type&access_token=${encodeURIComponent(env.INSTAGRAM_ACCESS_TOKEN!)}`,
      { signal: AbortSignal.timeout(20_000) }
    );
    const data = (await response.json().catch(() => null)) as {
      username?: string;
      account_type?: string;
      error?: InstagramGraphError;
    } | null;
    if (!response.ok || data?.error) {
      if (data?.error?.code === 190) {
        return {
          ok: false,
          message: `Meta tokenni qabul qilmadi (${env.INSTAGRAM_API_MODE === "instagram_login" ? "Instagram Login" : "Facebook Login"} ulanishi). Token yoki Meta'dagi akkaunt ruxsatini tekshiring`
        };
      }
      return { ok: false, message: `Instagram API: ${data?.error?.message ?? response.status}` };
    }
    return {
      ok: true,
      message: "Instagram akkaunti bilan ulanish muvaffaqiyatli",
      username: data?.username,
      accountType: data?.account_type
    };
  } catch {
    return { ok: false, message: "Instagram bilan ulanishni tekshirib bo'lmadi. Birozdan keyin qayta urinib ko'ring." };
  }
}

async function publishCarousel(caption: string, articleId: string) {
  const coverUrl = instagramArticleCoverUrl(articleId);
  const originalImageUrl = brandedArticleImageUrl(articleId);
  if (!coverUrl || !originalImageUrl) throw new Error("Instagram uchun public media URL sozlanmagan");

  const coverId = await graphRequest(`/${env.INSTAGRAM_USER_ID}/media`, {
    access_token: env.INSTAGRAM_ACCESS_TOKEN!,
    image_url: coverUrl,
    is_carousel_item: true
  });
  await waitForContainer(coverId);

  const originalId = await graphRequest(`/${env.INSTAGRAM_USER_ID}/media`, {
    access_token: env.INSTAGRAM_ACCESS_TOKEN!,
    image_url: originalImageUrl,
    is_carousel_item: true
  });
  await waitForContainer(originalId);

  const carouselId = await graphRequest(`/${env.INSTAGRAM_USER_ID}/media`, {
    access_token: env.INSTAGRAM_ACCESS_TOKEN!,
    media_type: "CAROUSEL",
    children: `${coverId},${originalId}`,
    caption
  });
  await waitForContainer(carouselId);
  return carouselId;
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
    const containerId = format === "POST"
      ? await publishCarousel(caption, article.id)
      : await graphRequest(`/${env.INSTAGRAM_USER_ID}/media`, {
          access_token: env.INSTAGRAM_ACCESS_TOKEN!,
          caption,
          media_type: "REELS",
          video_url: (() => {
            const url = brandedArticleVideoUrl(article.id);
            if (!url) throw new Error("Instagram Reel uchun media-renderer xizmatini sozlang");
            return url;
          })(),
          share_to_feed: true
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

export function queueArticleInstagramPost(
  article: { id: string; status: ArticleStatus; publishedAt: Date | null },
  options: { force?: boolean } = {}
) {
  if (!configured || !instagramQueue || article.status !== "PUBLISHED") return;
  const revision = article.publishedAt?.getTime() ?? Date.now();
  void instagramQueue.add("article", { articleId: article.id }, {
    // A failed BullMQ job with the same id remains retained for diagnostics. A deliberate
    // retry must get a fresh id after an editor fixes the Meta token or article media.
    jobId: options.force ? `instagram-${article.id}-retry-${Date.now()}-${randomUUID()}` : `instagram-${article.id}-${revision}`,
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
