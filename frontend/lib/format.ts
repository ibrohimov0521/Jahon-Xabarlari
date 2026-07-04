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
