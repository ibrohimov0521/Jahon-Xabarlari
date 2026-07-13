const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

export function startOfTashkentDay(date = new Date()) {
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - TASHKENT_OFFSET_MS);
}

export function daysAgoFromTashkentDay(days: number, date = new Date()) {
  return new Date(startOfTashkentDay(date).getTime() - days * 24 * 60 * 60 * 1000);
}
