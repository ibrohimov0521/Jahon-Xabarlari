export function positiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function pagination(query: Record<string, unknown>, defaults = { limit: 50, max: 100 }) {
  const page = positiveInt(query.page, 1, 1_000_000);
  const take = positiveInt(query.limit, defaults.limit, defaults.max);
  return { page, take, skip: (page - 1) * take };
}
