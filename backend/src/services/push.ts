import webpush from "web-push";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

const configured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export function getPushPublicKey() {
  return configured ? env.VAPID_PUBLIC_KEY! : null;
}

export function queueArticlePush(articleId: string) {
  if (!configured) return;
  setTimeout(() => {
    sendArticlePush(articleId).catch((error) => console.error("[push] notification failed:", error));
  }, 0);
}

async function sendArticlePush(articleId: string) {
  // Claim the article before sending so simultaneous status/flag updates cannot create duplicates.
  const claim = await prisma.article.updateMany({
    where: {
      id: articleId,
      status: "PUBLISHED",
      deletedAt: null,
      pushSentAt: null,
      OR: [{ isBreaking: true }, { isFeatured: true }]
    },
    data: { pushSentAt: new Date() }
  });
  if (!claim.count) return;

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      category: { select: { slug: true } },
      translations: {
        where: { status: "READY" },
        select: { lang: true, title: true, summary: true }
      }
    }
  });
  if (!article) return;

  const subscriptions = await prisma.webPushSubscription.findMany({ where: { enabled: true } });
  if (!subscriptions.length) return;

  const successIds: string[] = [];
  const invalidIds: string[] = [];
  const failedIds: string[] = [];

  for (let start = 0; start < subscriptions.length; start += 50) {
    const batch = subscriptions.slice(start, start + 50);
    await Promise.all(
      batch.map(async (subscription) => {
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
          actions: [{ action: "open", title: subscription.language === "ru" ? "Открыть" : subscription.language === "en" ? "Read" : "O'qish" }]
        });

        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
            { TTL: article.isBreaking ? 3600 : 14400, urgency: article.isBreaking ? "high" : "normal", topic: article.id }
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

  console.log(`[push] ${article.slug}: ${successIds.length} sent, ${invalidIds.length} removed, ${failedIds.length} failed`);
}
