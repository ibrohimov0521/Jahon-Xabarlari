import { API_URL } from "../../lib/config";
import { timeoutSignal } from "../../lib/http";
import { SITE_NAME, SITE_URL } from "../../lib/site";

type Item = { slug: string; title: string; publishedAt?: string | null };

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
}

export async function GET() {
  let items: Item[] = [];
  try {
    const response = await fetch(`${API_URL}/articles/sitemap`, { next: { revalidate: 300 }, signal: timeoutSignal() });
    if (response.ok) items = ((await response.json()) as { items?: Item[] }).items ?? [];
  } catch {
    items = [];
  }

  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const urls = items
    .filter((item) => item.publishedAt && new Date(item.publishedAt).getTime() >= cutoff)
    .slice(0, 1_000)
    .map((item) => `
  <url>
    <loc>${SITE_URL}/articles/${escapeXml(item.slug)}</loc>
    <news:news>
      <news:publication><news:name>${escapeXml(SITE_NAME)}</news:name><news:language>uz</news:language></news:publication>
      <news:publication_date>${new Date(item.publishedAt!).toISOString()}</news:publication_date>
      <news:title>${escapeXml(item.title)}</news:title>
    </news:news>
  </url>`)
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls}
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
