function comparableText(value: string) {
  return value
    .replace(/^\s*(?:[#\p{Extended_Pictographic}\p{P}\p{S}]+\s*)+/gu, "")
    .toLocaleLowerCase("uz")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function firstParagraph(content: string) {
  return content.trim().split(/\n\s*\n/, 1)[0]?.trim() ?? "";
}

function headingsOverlap(left: string, right: string) {
  const normalizedLeft = comparableText(left.replace(/(?:\.\.\.|\u2026)\s*$/, ""));
  const normalizedRight = comparableText(right);
  return Boolean(
    normalizedLeft &&
      normalizedRight &&
      (normalizedLeft === normalizedRight || normalizedLeft.startsWith(normalizedRight) || normalizedRight.startsWith(normalizedLeft))
  );
}

// Older forwarded posts may have a headline that was stored with an ellipsis. When the
// first paragraph contains its full version, prefer that complete headline for the reader.
export function displayArticleTitle(title: string, content: string) {
  const candidate = firstParagraph(content);
  return /(?:\.\.\.|\u2026)\s*$/.test(title) && candidate.length <= 220 && headingsOverlap(title, candidate)
    ? candidate
    : title;
}

// Forwarded posts often keep their headline as the first paragraph. The title already
// appears above the article, so render that paragraph only once without mutating the source.
export function withoutRepeatedArticleHeading(content: string, title: string) {
  const body = content.trim();
  const paragraphEnd = body.search(/\n\s*\n/);
  if (paragraphEnd < 0) return body;

  const leadingParagraph = body.slice(0, paragraphEnd).trim();
  return headingsOverlap(title, leadingParagraph) ? body.slice(paragraphEnd).trim() : body;
}
