import { readTextResponse, safeFetch } from "./net-guard.js";

export type FeedMediaInput = {
  link: string;
  mediaUrl?: string | null;
  fallbackMediaUrl?: string | null;
};

export type RawFeedMediaInput = {
  enclosure?: unknown;
  mediaContent?: unknown;
  mediaThumbnail?: unknown;
  contentEncoded?: string;
  "content:encoded"?: string;
  content?: string;
};

type MediaCandidate = {
  url: string;
  type?: string | null;
  width?: number;
  height?: number;
  fileSize?: number;
  priority?: number;
};

const LOW_QUALITY_MEDIA = /(thumb|thumbnail|small|150x|200x|300x|_s\.|\/s\d{2,3}\/)/i;
const HIGH_QUALITY_MEDIA = /(original|full(?:size)?|large|1200x|1600x|1920x)/i;

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  return null;
}

function absolutizeMediaUrl(url: string | null, baseUrl: string) {
  if (!url) return null;
  const decoded = decodeHtml(url.trim());
  if (!/^https?:\/\//i.test(decoded) && !decoded.startsWith("//") && !decoded.startsWith("/")) return null;
  try {
    return new URL(decoded.startsWith("//") ? `https:${decoded}` : decoded, baseUrl).toString();
  } catch {
    return null;
  }
}

function isHttpUrl(url: string | null) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function looksLikeMedia(url: string | null, mimeType?: string | null) {
  return Boolean(
    isHttpUrl(url) &&
      ((mimeType && /^(image|video)\//i.test(mimeType)) || /\.(jpe?g|png|webp|gif|avif|mp4|webm|mov)(?:[?#].*)?$/i.test(url!))
  );
}

export function isLowQualityMediaUrl(url: string) {
  return LOW_QUALITY_MEDIA.test(url);
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function mediaCandidate(value: unknown): MediaCandidate | null {
  if (typeof value === "string" && value.trim()) return { url: value.trim() };
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const attrs = record.$ && typeof record.$ === "object" ? (record.$ as Record<string, unknown>) : record;
  const url = firstString(attrs.url ?? attrs.href ?? record.url ?? record.href);
  if (!url) return null;
  return {
    url,
    type: firstString(attrs.type ?? attrs.medium ?? record.type ?? record.medium),
    width: numeric(attrs.width ?? record.width),
    height: numeric(attrs.height ?? record.height),
    fileSize: numeric(attrs.fileSize ?? attrs.length ?? record.fileSize ?? record.length)
  };
}

function collectMedia(value: unknown): MediaCandidate[] {
  if (Array.isArray(value)) return value.flatMap(collectMedia);
  const candidate = mediaCandidate(value);
  return candidate ? [candidate] : [];
}

function urlWidth(url: string) {
  try {
    const parsed = new URL(url);
    for (const key of ["width", "w", "size"]) {
      const value = Number(parsed.searchParams.get(key));
      if (Number.isFinite(value) && value > 0) return value;
    }
  } catch {
    return 0;
  }
  return 0;
}

function scoreCandidate(candidate: MediaCandidate) {
  const dimensions = candidate.width && candidate.height ? candidate.width * candidate.height : 0;
  const hintedWidth = urlWidth(candidate.url);
  // Metadata priority must dominate dimensions: a huge inline banner must not replace og:image.
  let score = (candidate.priority ?? 0) * 10_000_000;
  score += dimensions || candidate.fileSize || (hintedWidth ? hintedWidth * hintedWidth : 1);
  if (HIGH_QUALITY_MEDIA.test(candidate.url)) score += 2_000_000;
  if (LOW_QUALITY_MEDIA.test(candidate.url)) score *= 0.08;
  return score;
}

function chooseBest(candidates: MediaCandidate[], baseUrl: string, requireMediaHint = true) {
  return candidates
    .map((candidate) => ({ ...candidate, url: absolutizeMediaUrl(candidate.url, baseUrl) }))
    .filter((candidate): candidate is MediaCandidate => Boolean(candidate.url) && (!requireMediaHint || looksLikeMedia(candidate.url, candidate.type)))
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0]?.url ?? null;
}

function parseAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) attrs[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  return attrs;
}

function srcsetCandidates(srcset: string, priority: number): MediaCandidate[] {
  return srcset.split(",").map((part) => {
    const [url, descriptor] = part.trim().split(/\s+/, 2);
    const width = descriptor?.endsWith("w") ? numeric(descriptor.slice(0, -1)) : undefined;
    return { url, width, height: width, priority };
  }).filter((candidate) => Boolean(candidate.url));
}

function extractHtmlMediaCandidates(html: string | undefined): MediaCandidate[] {
  if (!html) return [];
  const candidates: MediaCandidate[] = [];
  for (const tag of html.match(/<(?:video|source|img)\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    if (attrs.srcset) candidates.push(...srcsetCandidates(attrs.srcset, 20_000));
    if (attrs.src) {
      candidates.push({
        url: attrs.src,
        type: tag.toLowerCase().startsWith("<video") || tag.toLowerCase().startsWith("<source") ? attrs.type ?? "video/unknown" : "image/unknown",
        width: numeric(attrs.width),
        height: numeric(attrs.height),
        priority: tag.toLowerCase().startsWith("<img") ? 5_000 : 30_000
      });
    }
  }
  return candidates;
}

export function extractPrimaryFeedMedia(item: RawFeedMediaInput, baseUrl: string) {
  return chooseBest([...collectMedia(item.enclosure), ...collectMedia(item.mediaContent)], baseUrl);
}

export function extractFallbackFeedMedia(item: RawFeedMediaInput, baseUrl: string) {
  return chooseBest(
    [...collectMedia(item.mediaThumbnail), ...extractHtmlMediaCandidates(item.contentEncoded ?? item["content:encoded"] ?? item.content)],
    baseUrl
  );
}

export function extractMetaMedia(html: string, baseUrl: string) {
  const candidates: MediaCandidate[] = [];
  for (const tag of html.match(/<(?:meta|link)\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? attrs.rel ?? "").toLowerCase();
    const url = attrs.content ?? attrs.href;
    if (!url) continue;
    const priorities: Record<string, number> = {
      "og:video": 9_000_000,
      "og:video:url": 9_000_000,
      "og:video:secure_url": 9_000_000,
      "og:image": 8_000_000,
      "og:image:url": 8_000_000,
      "og:image:secure_url": 8_000_000,
      "twitter:player:stream": 7_500_000,
      "twitter:image": 7_000_000,
      "twitter:image:src": 7_000_000,
      "image": 6_000_000,
      "image_src": 6_000_000
    };
    if (priorities[key]) candidates.push({ url, priority: priorities[key] });
  }

  for (const match of html.matchAll(/"image"\s*:\s*(?:\{[^{}]*?"url"\s*:\s*)?["']([^"']+)["']/gi)) {
    candidates.push({ url: match[1], priority: 5_000_000 });
  }
  candidates.push(...extractHtmlMediaCandidates(html));
  return chooseBest(candidates, baseUrl, false);
}

async function fetchPageMedia(link: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await safeFetch(link, {
      signal: controller.signal,
      headers: { "user-agent": "JahonXabarlariBot/1.0 (+https://jahonxabarlari.uz)" }
    });
    if (!response.ok) return null;
    const html = await readTextResponse(response, 500_000);
    return extractMetaMedia(html.slice(0, 250_000), link);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveArticleMedia(item: FeedMediaInput) {
  if (item.mediaUrl && !isLowQualityMediaUrl(item.mediaUrl)) return item.mediaUrl;
  const pageMedia = await fetchPageMedia(item.link);
  if (pageMedia) return pageMedia;
  return item.mediaUrl ?? item.fallbackMediaUrl ?? null;
}
