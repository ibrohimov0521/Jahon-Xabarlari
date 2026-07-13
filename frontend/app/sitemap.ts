import type { MetadataRoute } from "next";
import { API_URL } from "../lib/config";
import { timeoutSignal } from "../lib/http";
import { SITE_URL } from "../lib/site";

type ApiArticle = { slug: string; updatedAt?: string; publishedAt?: string };

async function getPublishedArticles() {
  try {
    const response = await fetch(`${API_URL}/articles/sitemap`, { next: { revalidate: 300 }, signal: timeoutSignal() });
    if (!response.ok) return [];
    const data = (await response.json()) as { items?: ApiArticle[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const articles = await getPublishedArticles();
  const categories = ["ozbekiston", "dunyo", "siyosat", "iqtisodiyot", "texnologiya", "sport", "madaniyat"];

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${SITE_URL}/popular`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    { url: `${SITE_URL}/editor-choice`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/ads`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    ...categories.map((slug) => ({
      url: `${SITE_URL}/category/${slug}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.8
    })),
    ...articles.map((article) => ({
      url: `${SITE_URL}/articles/${article.slug}`,
      lastModified: article.updatedAt ? new Date(article.updatedAt) : article.publishedAt ? new Date(article.publishedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.9
    }))
  ];
}
