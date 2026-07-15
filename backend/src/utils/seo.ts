function shorten(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  const shortened = normalized.slice(0, maxLength + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > maxLength * 0.65 ? lastSpace : maxLength).trim()}...`;
}

export function buildSeoTitle(title: string) {
  return shorten(title, 68);
}

export function buildSeoDescription(shortDescription: string | null | undefined, summary: string) {
  return shorten(shortDescription?.trim() || summary, 160);
}
