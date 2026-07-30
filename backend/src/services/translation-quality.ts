import type { Lang } from "./translate.js";

type TranslationFields = {
  title: string;
  content: string;
};

export type TranslationQualityResult = {
  valid: boolean;
  issues: string[];
};

const LETTERS = /[A-Za-z\u0400-\u04ff]/g;
const CYRILLIC = /[\u0400-\u04ff]/g;

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

function normalized(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function inspectTranslationQuality(
  source: TranslationFields,
  translated: TranslationFields,
  lang: Lang
): TranslationQualityResult {
  const issues: string[] = [];
  const sourceContent = normalized(source.content);
  const translatedContent = normalized(translated.content);
  const translatedTitle = normalized(translated.title);

  if (translatedTitle.length < 8) issues.push("TRANSLATED_TITLE_TOO_SHORT");
  if (translatedContent.length < Math.max(120, sourceContent.length * 0.45)) issues.push("TRANSLATED_CONTENT_TOO_SHORT");
  if (translatedContent === sourceContent || translatedTitle === normalized(source.title)) issues.push("NOT_TRANSLATED");

  const letters = countMatches(`${translated.title} ${translated.content}`, LETTERS);
  const cyrillic = countMatches(`${translated.title} ${translated.content}`, CYRILLIC);
  const cyrillicRatio = letters > 0 ? cyrillic / letters : 0;
  if (lang === "ru" && cyrillicRatio < 0.45) issues.push("WRONG_RUSSIAN_SCRIPT");
  if (lang === "en" && cyrillicRatio > 0.02) issues.push("WRONG_ENGLISH_SCRIPT");

  return { valid: issues.length === 0, issues };
}
