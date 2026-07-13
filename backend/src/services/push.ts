import type { ArticleStatus } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import webpush from "web-push";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { createBullConnection, withRedisLock } from "./redis.js";

const configured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export function getPushPublicKey() {
  return configured ? env.VAPID_PUBLIC_KEY! : null;
}

type PushJob = {
  articleId: string;
  subscriptionIds?: string[];
  retryNumber?: number;
  retryBatch?: number;
};
type PushJobName = "article";

export function queueArticlePush(article: { id: string; status: ArticleStatus; publishedAt: Date | null }) {
  if (!configured || article.status !== "PUBLISHED") return;
  const revision = article.publishedAt?.getTime() ?? Date.now();
  void pushQueue
    .add(
      "article",
      { articleId: article.id },
      {
        jobId: `article-${article.id}-${revision}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 5_000 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 }
      }
    )
    .catch((error) => console.error("[push] notification navbatga olinmadi:", error));
}

async function queueFailedPushes(articleId: string, ids: string[], retryNumber: number, retryBatch: number) {
  if (!ids.length || retryNumber > 4) return;
  await pushQueue.add(
    "article",
    { articleId, subscriptionIds: ids, retryNumber, retryBatch },
    {
      jobId: `article-${articleId}-retry-${retryNumber}-${retryBatch}`,
      delay: Math.min(10_000 * 2 ** (retryNumber - 1), 120_000),
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 5_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 }
    }
  );
}

async function sendArticlePush(job: PushJob) {
  const targetedRetry = Boolean(job.subscriptionIds?.length);
  const article = await prisma.article.findUnique({
    where: { id: job.articleId },
    include: {
      category: { select: { slug: true } },
      translations: {
        where: { status: "READY" },
        select: { lang: true, title: true, summary: true }
      }
    }
  });
  if (!article || article.status !== "PUBLISHED" || article.deletedAt || (!targetedRetry && article.pushSentAt)) return;

  let sentCount = 0;
  let invalidCount = 0;
  let failedCount = 0;
  let retryBatch = job.retryBatch ?? 0;
  let cursor: string | undefined;

  while (true) {
    const subscriptions = await prisma.webPushSubscription.findMany({
      where: {
        enabled: true,
        ...(targetedRetry ? { id: { in: job.subscriptionIds } } : {})
      },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });
    if (!subscriptions.length) break;
    cursor = subscriptions.at(-1)!.id;

    const successIds: string[] = [];
    const invalidIds: string[] = [];
    const failedIds: string[] = [];

    for (let start = 0; start < subscriptions.length; start += 50) {
      const batch = subscriptions.slice(start, start + 50);
      await Promise.all(
        batch.map(async (subscription) => {
          if (subscription.importantOnly && !article.isBreaking && !article.isFeatured) return;
          if (subscription.categorySlugs.length && !subscription.categorySlugs.includes(article.category.slug)) return;

          const translation = article.translations.find((item) => item.lang === subscription.language);
          const title = translation?.title || article.title;
          const body = (translation?.summary || article.shortDescription || article.summary).slice(0, 180);
          const payload = JSON.stringify({
            title,
            body,
            icon: "/logo.png",
            badge: "/favicon-96x96.png",
            image: article.mainImage || undefined,
            tag: `article-${article.id}`,
            renotify: article.isBreaking,
            requireInteraction: article.isBreaking,
            data: { url: `/articles/${article.slug}`, articleId: article.id },
            actions: [
              {
                action: "open",
                title: subscription.language === "ru" ? "Открыть" : subscription.language === "en" ? "Read" : "O'qish"
              }
            ]
          });

          try {
            await webpush.sendNotification(
              { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
              payload,
              {
                TTL: article.isBreaking ? 3600 : 14400,
                urgency: article.isBreaking ? "high" : "normal",
                topic: article.id
              }
            );
            successIds.push(subscription.id);
          } catch (error) {
            const statusCode = (error as { statusCode?: number }).statusCode;
            if (statusCode === 404 || statusCode === 410) invalidIds.push(subscription.id);
            else failedIds.push(subscription.id);
          }
        })
      );
    }

    await Promise.all([
      successIds.length
        ? prisma.webPushSubscription.updateMany({
            where: { id: { in: successIds } },
            data: { failureCount: 0, lastSuccessAt: new Date() }
          })
        : Promise.resolve(),
      invalidIds.length
        ? prisma.webPushSubscription.deleteMany({ where: { id: { in: invalidIds } } })
        : Promise.resolve(),
      failedIds.length
        ? prisma.webPushSubscription.updateMany({
            where: { id: { in: failedIds } },
            data: { failureCount: { increment: 1 } }
          })
        : Promise.resolve()
    ]);

    if (failedIds.length) {
      await prisma.webPushSubscription.updateMany({
        where: { id: { in: failedIds }, failureCount: { gte: 5 } },
        data: { enabled: false }
      });
      const retryable = await prisma.webPushSubscription.findMany({
        where: { id: { in: failedIds }, enabled: true },
        orderBy: { id: "asc" },
        select: { id: true }
      });
      if (retryable.length) {
        await queueFailedPushes(
          article.id,
          retryable.map((item) => item.id),
          (job.retryNumber ?? 0) + 1,
          retryBatch
        );
        retryBatch += 1;
      }
    }

    sentCount += successIds.length;
    invalidCount += invalidIds.length;
    failedCount += failedIds.length;
    if (targetedRetry) break;
  }

  if (!targetedRetry) {
    await prisma.article.update({ where: { id: article.id }, data: { pushSentAt: new Date() } });
  }

  console.log(
    `[push] ${article.slug}${targetedRetry ? ` retry-${job.retryNumber}` : ""}: ${sentCount} sent, ${invalidCount} removed, ${failedCount} failed`
  );
}

const pushQueue = new Queue<PushJob, void, PushJobName>("article-push", { connection: createBullConnection() });
const pushWorker = new Worker<PushJob, void, PushJobName>(
  "article-push",
  async (job) => {
    const handled = await withRedisLock(`lock:article-push:${job.data.articleId}`, 10 * 60 * 1000, async () => {
      await sendArticlePush(job.data);
      return true;
    });
    if (!handled) throw new Error("Bu maqola uchun boshqa push vazifasi hali ishlamoqda");
  },
  { connection: createBullConnection(), concurrency: 2 }
);
pushWorker.on("failed", (job, error) => console.error(`[push] job ${job?.id ?? "unknown"} failed:`, error));
pushWorker.on("error", (error) => console.error("[push] worker Redis xatosi:", error));
pushQueue.on("error", (error) => console.error("[push] queue Redis xatosi:", error));

export async function closePushJobs() {
  await Promise.all([pushWorker.close(), pushQueue.close()]);
}
