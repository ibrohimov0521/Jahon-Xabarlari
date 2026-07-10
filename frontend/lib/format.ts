const TASHKENT_TIME_ZONE = "Asia/Tashkent";

export function formatArticleDateTime(value?: string | null) {
  if (!value) return "Sana kiritilmagan";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sana kiritilmagan";

  const dateText = new Intl.DateTimeFormat("uz-UZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TASHKENT_TIME_ZONE
  }).format(date);
  const timeText = new Intl.DateTimeFormat("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TASHKENT_TIME_ZONE
  }).format(date);

  return `${dateText} • ${timeText}`;
}

// Compact metadata for dense mobile cards: "10-iyl • 14:26" (no year).
export function formatDateCompact(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const d = new Intl.DateTimeFormat("uz-UZ", { day: "numeric", month: "short", timeZone: TASHKENT_TIME_ZONE }).format(date);
  const t = new Intl.DateTimeFormat("uz-UZ", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TASHKENT_TIME_ZONE }).format(date);
  return `${d} • ${t}`;
}

export function formatViewsCompact(count = 0) {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return (thousands >= 10 ? Math.round(thousands).toString() : thousands.toFixed(1).replace(".", ",")) + "K";
}

export function formatViews(count = 0) {
  if (count < 1000) return `${count} ko'rish`;
  const thousands = count / 1000;
  const rounded = thousands >= 10 ? Math.round(thousands).toString() : thousands.toFixed(1).replace(".", ",");
  return `${rounded} ming ko'rish`;
}

export function getTashkentDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("uz-UZ", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TASHKENT_TIME_ZONE
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: pick("weekday"),
    day: pick("day"),
    month: pick("month"),
    year: pick("year")
  };
}
