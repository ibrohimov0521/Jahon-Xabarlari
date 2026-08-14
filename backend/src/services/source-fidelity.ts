export type SourceFidelityInput = {
  sourceTitle: string;
  sourceText: string;
  generatedTitle: string;
  generatedContent: string;
  category?: string | null;
  confidence?: number | null;
  aiSupported?: boolean | null;
  aiPreservedUncertainty?: boolean | null;
  aiIssues?: string[];
};

export type SourceFidelityResult = {
  publishable: boolean;
  highRisk: boolean;
  sourceIsUncertain: boolean;
  issues: string[];
};

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("uz")
    .replace(/[‘’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const UNCERTAINTY_SOURCE =
  /xabar(?:lar)? tarqal|da['’]?vo|taxmin|ehtimol|tasdiqlan(?:magan|gani yo['’]?q|madi)|rasmiy (?:ma['’]?lumot|tasdiq) yo['’]?q|aytilishicha|manbaning xabariga ko['’]?ra|reportedly|alleged|unconfirmed|has not confirmed|have not confirmed|according to|may have|might have|сообщается|по данным|предположительно|якобы|не подтвержд|утверждает/i;
const UNCERTAINTY_GENERATED =
  /xabar(?:lar)? tarqal|da['’]?vo|taxmin|ehtimol|tasdiqlan(?:magan|gani yo['’]?q|madi)|rasmiy (?:ma['’]?lumot|tasdiq) yo['’]?q|aytilishicha|ma['’]?lumotiga ko['’]?ra|manbaga ko['’]?ra/i;
const HIGH_RISK =
  /harbiy|mudofaa|qurol|samolyot|qiruvchi|raketa|urush|armiya|siyosat|prezident|hukumat|saylov|vazir|tibb|sog['’]?liq|kasallik|dori|vaksina|bank|moliya|iqtisod|valyuta|invest|military|defen[cs]e|weapon|fighter jet|missile|war|politic|election|president|government|health|medical|disease|medicine|vaccine|finance|bank|econom|военн|оборон|оруж|полит|выбор|президент|правитель|медицин|здоров|болез|вакцин|финанс|банк|эконом/i;

const GENERIC_FILLER = [
  "e'tiborga sazovor",
  "muhim qadam",
  "xizmat qilishi mumkin",
  "salohiyatini oshirish",
  "tayyorligini ko'rsatmoqda",
  "yangi imkoniyatlar yaratadi",
  "kelgusida muhim rol o'ynashi mumkin"
];

function numbers(value: string) {
  return new Set(
    value.match(/\b\d+(?:[.,]\d+)?%?/g)?.map((item) => item.replace(",", ".").replace(/^0+(?=\d)/, "")) ?? []
  );
}

function quotedClaims(value: string) {
  const claims: string[] = [];
  const quotePattern = /["“«]([^"”»]{6,180})["”»]/g;
  for (const match of value.matchAll(quotePattern)) claims.push(normalize(match[1]));
  return claims;
}

export function inspectSourceFidelity(input: SourceFidelityInput): SourceFidelityResult {
  const source = normalize(`${input.sourceTitle} ${input.sourceText}`);
  const generated = normalize(`${input.generatedTitle} ${input.generatedContent}`);
  const issues = new Set<string>();
  const sourceNumbers = numbers(source);
  const sourceIsUncertain = UNCERTAINTY_SOURCE.test(source);
  const highRisk = HIGH_RISK.test(`${input.category ?? ""} ${source}`);

  for (const value of numbers(generated)) {
    if (!sourceNumbers.has(value)) issues.add(`UNSUPPORTED_NUMBER:${value}`);
  }

  if (sourceIsUncertain && !UNCERTAINTY_GENERATED.test(generated)) {
    issues.add("SOURCE_UNCERTAINTY_REMOVED");
  }

  if (sourceIsUncertain && input.aiPreservedUncertainty === false) {
    issues.add("AI_DETECTED_UNCERTAINTY_CHANGE");
  }

  if (input.aiSupported === false) issues.add("AI_DETECTED_UNSUPPORTED_CLAIM");
  for (const issue of input.aiIssues ?? []) {
    const clean = issue.trim().slice(0, 180);
    if (clean) issues.add(`AI:${clean}`);
  }

  for (const quote of quotedClaims(generated)) {
    if (!source.includes(quote)) issues.add("UNSUPPORTED_QUOTE");
  }

  for (const phrase of GENERIC_FILLER) {
    if (generated.includes(phrase) && !source.includes(phrase)) issues.add(`GENERIC_FILLER:${phrase}`);
  }

  if (generated.length > Math.max(700, source.length * 2.2)) issues.add("CONTENT_EXPANDED_BEYOND_SOURCE");
  if ((input.confidence ?? 1) < 0.7) issues.add("LOW_AI_CONFIDENCE");
  if (highRisk && (input.confidence ?? 1) < 0.9) issues.add("LOW_CONFIDENCE_HIGH_RISK");
  if (highRisk && sourceIsUncertain) issues.add("HIGH_RISK_UNVERIFIED_SOURCE");

  return {
    publishable: issues.size === 0,
    highRisk,
    sourceIsUncertain,
    issues: [...issues]
  };
}
