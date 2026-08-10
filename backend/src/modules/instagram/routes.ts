import { Router, type Request, type Response as ExpressResponse } from "express";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { safeFetch } from "../../services/net-guard.js";
import { applyBrandWatermark, createInstagramNewsCover } from "../../services/brand-media.js";

export const instagramRouter = Router();

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

async function responseBuffer(response: globalThis.Response, maxBytes: number) {
  const size = Number(response.headers.get("content-length"));
  if (Number.isFinite(size) && size > maxBytes) throw new Error("Rasm hajmi limitdan katta");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error("Rasm hajmi limitdan katta");
  return buffer;
}

async function articleImageBuffer(source: string) {
  const base = env.BACKEND_PUBLIC_URL ?? "http://localhost";
  const url = new URL(source, base);
  const keyMatch = url.pathname.match(/\/api\/admin\/media\/file\/([^/]+)$/);
  if (keyMatch) {
    const media = await prisma.mediaFile.findUnique({ where: { key: decodeURIComponent(keyMatch[1]) }, select: { data: true, mimeType: true } });
    if (!media?.data || !media.mimeType.startsWith("image/")) throw new Error("Saqlangan rasm topilmadi");
    return { buffer: Buffer.isBuffer(media.data) ? media.data : Buffer.from(media.data), alreadyBranded: true };
  }
  const response = await safeFetch(url.toString(), {
    headers: { "user-agent": "BEST-TEAM-NEWS-Media/1.0", accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
    signal: AbortSignal.timeout(25_000)
  });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error("Asl rasmni olishning iloji bo'lmadi");
  return { buffer: await responseBuffer(response, MAX_IMAGE_BYTES), alreadyBranded: false };
}

async function sendBrandedArticleImage(req: Request, res: ExpressResponse) {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id },
    select: { mainImage: true, gallery: true, status: true, deletedAt: true }
  });
  const index = Math.max(0, Math.floor(Number(req.params.index ?? "0")) || 0);
  const sourceUrl = index === 0 ? article?.mainImage : article?.gallery[index - 1];
  if (!article || article.status !== "PUBLISHED" || article.deletedAt || !sourceUrl) {
    return res.status(404).json({ message: "Rasm topilmadi" });
  }
  if (/\.(?:mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(sourceUrl)) {
    return res.status(415).json({ message: "Video uchun Reel media manzili kerak" });
  }

  try {
    const source = await articleImageBuffer(sourceUrl);
    const branded = source.alreadyBranded ? source.buffer : await applyBrandWatermark(source.buffer);
    res.set({ "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" }).send(branded);
  } catch (error) {
    console.error("[instagram] branded image render failed:", error);
    res.status(502).json({ message: "Instagram uchun rasm tayyorlanmadi" });
  }
}

async function sendInstagramArticleCover(req: Request, res: ExpressResponse) {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id },
    select: { title: true, mainImage: true, status: true, deletedAt: true }
  });
  if (!article || article.status !== "PUBLISHED" || article.deletedAt || !article.mainImage) {
    return res.status(404).json({ message: "Rasm topilmadi" });
  }
  if (/\.(?:mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(article.mainImage)) {
    return res.status(415).json({ message: "Video uchun Reel media manzili kerak" });
  }

  try {
    const source = await articleImageBuffer(article.mainImage);
    const cover = await createInstagramNewsCover(source.buffer, article.title);
    res.set({ "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" }).send(cover);
  } catch (error) {
    console.error("[instagram] cover render failed:", error);
    res.status(502).json({ message: "Instagram uchun sarlavhali rasm tayyorlanmadi" });
  }
}

async function sendArticleVideo(req: Request, res: ExpressResponse) {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id },
    select: { mainImage: true, gallery: true, status: true, deletedAt: true }
  });
  const index = Math.max(0, Math.floor(Number(req.params.index ?? "0")) || 0);
  const sourceUrl = index === 0 ? article?.mainImage : article?.gallery[index - 1];
  if (!article || article.status !== "PUBLISHED" || article.deletedAt || !sourceUrl) {
    return res.status(404).json({ message: "Video topilmadi" });
  }

  try {
    const base = env.BACKEND_PUBLIC_URL ?? "http://localhost";
    const url = new URL(sourceUrl, base);
    const keyMatch = url.pathname.match(/\/api\/admin\/media\/file\/([^/]+)$/);
    if (keyMatch) {
      const media = await prisma.mediaFile.findUnique({ where: { key: decodeURIComponent(keyMatch[1]) }, select: { data: true, mimeType: true } });
      if (!media?.data || !media.mimeType.startsWith("video/")) throw new Error("Saqlangan video topilmadi");
      const data = Buffer.isBuffer(media.data) ? media.data : Buffer.from(media.data);
      return res.set({ "Content-Type": media.mimeType, "Content-Length": data.length.toString(), "Cache-Control": "public, max-age=3600" }).send(data);
    }
    const response = await safeFetch(url.toString(), {
      headers: { "user-agent": "BEST-TEAM-NEWS-Media/1.0", accept: "video/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(45_000)
    });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("video/")) throw new Error("Asl videoni olishning iloji bo'lmadi");
    const buffer = await responseBuffer(response, MAX_VIDEO_BYTES);
    res.set({ "Content-Type": response.headers.get("content-type")!, "Content-Length": buffer.length.toString(), "Cache-Control": "public, max-age=3600" }).send(buffer);
  } catch (error) {
    console.error("[instagram] video source failed:", error);
    res.status(502).json({ message: "Video tayyorlanmadi" });
  }
}

instagramRouter.get("/social/instagram/articles/:id/image", sendBrandedArticleImage);
instagramRouter.get("/social/instagram/articles/:id/image/:index", sendBrandedArticleImage);
instagramRouter.get("/social/instagram/articles/:id/cover", sendInstagramArticleCover);
instagramRouter.get("/social/instagram/articles/:id/video", sendArticleVideo);
instagramRouter.get("/social/instagram/articles/:id/video/:index", sendArticleVideo);
