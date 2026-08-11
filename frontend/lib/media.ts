// Shared, server-safe media helpers (no browser APIs, no "use client") so both the client
// MediaView component and server article page can use one implementation.
export function isVideoUrl(src?: string | null) {
  return !!src && /\.(mp4|webm|mov)(?:\?|#|$)/i.test(src);
}

const LOW_QUALITY_MEDIA = /(thumb|thumbnail|small|150x|200x|300x|_s\.|\/s\d{2,3}\/)/i;
const BRAND_MEDIA_VERSION = "best-team-v3";

// Old uploads were stored with a watermark baked into their pixels. Give those media URLs a new
// version so browsers do not keep rendering a cached legacy image while the API replaces it.
export function withCurrentBrandMedia(src: string) {
  try {
    const isAbsolute = /^https?:\/\//i.test(src);
    const url = new URL(src, "https://jahonxabarlari.uz");
    if (!/\/api\/admin\/media\/file\/[^/]+$/i.test(url.pathname) || url.searchParams.has("brand")) return src;
    url.searchParams.set("brand", BRAND_MEDIA_VERSION);
    url.searchParams.set("replace", "1");
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return src;
  }
}

function explicitMediaWidth(src: string) {
  try {
    const url = new URL(src, "https://jahonxabarlari.uz");
    for (const key of ["width", "w", "size"]) {
      const width = Number(url.searchParams.get(key));
      if (Number.isFinite(width) && width > 0) return width;
    }
    const dimension = url.pathname.match(/(?:^|[-_/])(\d{2,4})x\d{2,4}(?:[-_/.,]|$)/i);
    return dimension ? Number(dimension[1]) : 0;
  } catch {
    return 0;
  }
}

export function isSuitableHeroMedia(src?: string | null) {
  if (!src?.trim()) return false;
  if (isVideoUrl(src)) return true;
  if (LOW_QUALITY_MEDIA.test(src)) return false;
  const width = explicitMediaWidth(src);
  return width === 0 || width >= 800;
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
