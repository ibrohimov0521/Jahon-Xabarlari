import dns from "node:dns/promises";
import net from "node:net";

// SSRF guard. The aggregator fetches remote feed URLs and article pages that an authenticated
// editor can supply, so without these checks a crafted source could point the server at internal
// hosts -- most dangerously the cloud metadata endpoint (169.254.169.254) or localhost services.

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split(".").map(Number);
    if (a === 0 || a === 127) return true; // "this host" + loopback
    if (a === 10) return true; // private
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // protocol assignments / documentation
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmark network
    if (a === 198 && b === 51 && c === 100) return true; // documentation
    if (a === 203 && b === 0 && c === 113) return true; // documentation
    if (a >= 224) return true; // multicast and reserved
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice(7);
    if (net.isIPv4(mapped)) return isPrivateIp(mapped);
    const words = mapped.split(":");
    if (words.length === 2 && words.every((word) => /^[0-9a-f]{1,4}$/.test(word))) {
      const high = Number.parseInt(words[0], 16);
      const low = Number.parseInt(words[1], 16);
      return isPrivateIp(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
    }
    return true;
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
  if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
  if (lower.startsWith("ff")) return true; // multicast
  if (lower.startsWith("2001:db8") || lower.startsWith("2001:0:") || lower.startsWith("2002:")) return true;
  if (lower.startsWith("64:ff9b:")) return true; // IPv4 translation ranges can conceal private IPv4
  return false;
}

// Throws if the URL is malformed, not http(s), or resolves to a private/loopback/link-local
// address. Every A/AAAA record is checked so a hostname can't hide one internal answer.
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL yaroqsiz");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Faqat http/https manzillar ruxsat etilgan");
  }
  if (url.username || url.password) {
    throw new Error("URL ichida login yoki parol bo'lishi mumkin emas");
  }
  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Ichki tarmoq manzillari taqiqlangan");
    return;
  }
  const records = await dns.lookup(host, { all: true });
  if (!records.length) throw new Error("Host topilmadi");
  for (const record of records) {
    if (isPrivateIp(record.address)) throw new Error("Ichki tarmoq manzillari taqiqlangan");
  }
}

// fetch that re-validates every redirect hop, so a public URL can't 30x-redirect into an internal
// target after the initial check passes.
export async function safeFetch(rawUrl: string, init: RequestInit & { maxRedirects?: number } = {}): Promise<Response> {
  const { maxRedirects = 3, ...rest } = init;
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicUrl(current);
    const response = await fetch(current, { ...rest, redirect: "manual" });
    const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
    if (!location) return response;
    await response.body?.cancel();
    current = new URL(location, current).toString();
  }
  throw new Error("Juda ko'p redirect");
}

export async function readTextResponse(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error("Javob hajmi ruxsat etilgan limitdan katta");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Javob hajmi ruxsat etilgan limitdan katta");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
