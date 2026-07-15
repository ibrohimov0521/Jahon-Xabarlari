export type ArticleQualityInput = {
  title: string;
  content: string;
  sourceUrl?: string | null;
  mainImage?: string | null;
  confidence?: number | null;
};

export type ArticleQualityResult = {
  score: number;
  publishable: boolean;
  issues: string[];
};

const CYRILLIC = /[\u0400-\u04ff]/g;
const LETTERS = /[A-Za-z\u0400-\u04ff]/g;
const LOW_QUALITY_MEDIA = /(thumb|thumbnail|small|150x|200x|300x|_s\.|\/s\d{2,3}\/)/i;

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

export function inspectArticleQuality(input: ArticleQualityInput): ArticleQualityResult {
  const title = input.title.trim();
  const content = input.content.trim();
  const issues: string[] = [];
  let score = 100;

  if (title.length < 18 || title.length > 180) {
    issues.push("TITLE_LENGTH");
    score -= 12;
  }

  if (content.length < 420) {
    issues.push("CONTENT_TOO_SHORT");
    score -= 28;
  }

  const sentenceCount = content.split(/(?<=[.!?])\s+/).filter((item) => item.trim().length >= 20).length;
  if (sentenceCount < 4) {
    issues.push("TOO_FEW_SENTENCES");
    score -= 18;
  }

  const combined = `${title} ${content}`;
  const letters = countMatches(combined, LETTERS);
  const cyrillic = countMatches(combined, CYRILLIC);
  if (letters > 0 && cyrillic / letters > 0.02) {
    issues.push("CYRILLIC_TEXT");
    score -= 30;
  }

  if (!input.sourceUrl) {
    issues.push("MISSING_SOURCE");
    score -= 20;
  }

  if (!input.mainImage) {
    issues.push("MISSING_MEDIA");
    score -= 15;
  } else if (LOW_QUALITY_MEDIA.test(input.mainImage)) {
    issues.push("LOW_QUALITY_MEDIA");
    score -= 18;
  }

  if (typeof input.confidence !== "number" || input.confidence < 0.78) {
    issues.push("LOW_AI_CONFIDENCE");
    score -= 24;
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  const blockers = new Set(["CONTENT_TOO_SHORT", "CYRILLIC_TEXT", "MISSING_SOURCE", "LOW_AI_CONFIDENCE"]);
  return {
    score: normalizedScore,
    issues,
    publishable: normalizedScore >= 85 && !issues.some((issue) => blockers.has(issue))
  };
}

export function normalizeArticleTags(tags: unknown, limit = 6) {
  if (!Array.isArray(tags)) return [];
  const unique = new Map<string, string>();
  for (const value of tags) {
    if (typeof value !== "string") continue;
    const name = value.replace(/[#\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (name.length < 2) continue;
    const key = name.toLocaleLowerCase("uz");
    if (!unique.has(key)) unique.set(key, name);
    if (unique.size >= limit) break;
  }
  return [...unique.values()];
}
