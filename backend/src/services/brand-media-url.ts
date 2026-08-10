import { env } from "../config/env.js";
import crypto from "node:crypto";

// Meta and Telegram fetch this public endpoint themselves. It returns a branded JPEG while
// keeping a publisher's original URL out of the social delivery pipeline.
export function brandedArticleImageUrl(articleId: string, mediaIndex = 0) {
  if (!env.BACKEND_PUBLIC_URL) return null;
  return new URL(
    `/api/social/instagram/articles/${encodeURIComponent(articleId)}/image/${mediaIndex}`,
    env.BACKEND_PUBLIC_URL
  ).toString();
}

// The renderer only accepts signed article references. The original source URL never appears in
// the public render URL, so the renderer cannot be turned into a generic video-fetching proxy.
export function brandedArticleVideoUrl(articleId: string, mediaIndex = 0) {
  if (!env.MEDIA_RENDERER_URL || !env.MEDIA_RENDERER_SECRET) return null;
  const payload = `${articleId}:${mediaIndex}`;
  const signature = crypto.createHmac("sha256", env.MEDIA_RENDERER_SECRET).update(payload).digest("hex");
  return new URL(`/render/${encodeURIComponent(articleId)}/${mediaIndex}?signature=${signature}`, env.MEDIA_RENDERER_URL).toString();
}
