// Shared, server-safe media helpers (no browser APIs, no "use client") so both the client
// MediaView component and server article page can use one implementation.
export function isVideoUrl(src?: string | null) {
  return !!src && /\.(mp4|webm|mov)(?:\?|#|$)/i.test(src);
}

// Route remote photos through this site's own Next image optimizer instead of hotlinking the
// third-party CDN directly. Visitors whose network can't reach the source CDN (regional blocks,
// hotlink protection) still get the image because their browser only ever talks to our origin.
// Same-origin, relative and data URLs are returned unchanged. Deterministic and server-safe, so
// server and client render an identical src -- no hydration drift.
export function toOptimizedImageSrc(src: string, width = 1200, quality = 75) {
  if (/^https?:\/\//i.test(src)) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
  }
  return src;
}
