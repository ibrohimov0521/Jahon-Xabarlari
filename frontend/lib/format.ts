const TASHKENT_TIME_ZONE = "Asia/Tashkent";

type Language = "uz" | "ru" | "en";

const locales: Record<Language, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-GB" };
const missingDate: Record<Language, string> = { uz: "Sana kiritilmagan", ru: "Дата не указана", en: "Date not provided" };

export function formatArticleDateTime(value?: string | null, language: Language = "uz") {
  if (!value) return missingDate[language];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return missingDate[language];

  const dateText = new Intl.DateTimeFormat(locales[language], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TASHKENT_TIME_ZONE
  }).format(date);
  const timeText = new Intl.DateTimeFormat(locales[language], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TASHKENT_TIME_ZONE
  }).format(date);

  return `${dateText} • ${timeText}`;
}

export function formatDateCompact(value?: string | null, language: Language = "uz") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dateText = new Intl.DateTimeFormat(locales[language], { day: "numeric", month: "short", timeZone: TASHKENT_TIME_ZONE }).format(date);
  const timeText = new Intl.DateTimeFormat(locales[language], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TASHKENT_TIME_ZONE }).format(date);
  return `${dateText} • ${timeText}`;
}

export function formatViewsCompact(count = 0) {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return (thousands >= 10 ? Math.round(thousands).toString() : thousands.toFixed(1).replace(".", ",")) + "K";
}

export function formatViews(count = 0, language: Language = "uz") {
  const viewLabel = language === "uz" ? "ko'rish" : language === "ru" ? "просмотров" : "views";
  if (count < 1000) return `${count} ${viewLabel}`;
  const thousands = count / 1000;
  const rounded = thousands >= 10 ? Math.round(thousands).toString() : thousands.toFixed(1).replace(".", ",");
  const thousandLabel = language === "uz" ? "ming ko'rish" : language === "ru" ? "тыс. просмотров" : "K views";
  return `${rounded} ${thousandLabel}`;
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
