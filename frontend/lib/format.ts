const TASHKENT_TIME_ZONE = "Asia/Tashkent";

type Language = "uz" | "ru" | "en";

const missingDate: Record<Language, string> = { uz: "Sana kiritilmagan", ru: "Дата не указана", en: "Date not provided" };
const shortMonths: Record<Language, string[]> = {
  uz: ["yan", "fev", "mar", "apr", "may", "iyun", "iyl", "avg", "sen", "okt", "noy", "dek"],
  ru: ["\u044f\u043d\u0432.", "\u0444\u0435\u0432\u0440.", "\u043c\u0430\u0440\u0442\u0430", "\u0430\u043f\u0440.", "\u043c\u0430\u044f", "\u0438\u044e\u043d\u044f", "\u0438\u044e\u043b\u044f", "\u0430\u0432\u0433.", "\u0441\u0435\u043d\u0442.", "\u043e\u043a\u0442.", "\u043d\u043e\u044f\u0431.", "\u0434\u0435\u043a."],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
};

function tashkentParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TASHKENT_TIME_ZONE
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: Number(pick("day")),
    monthIndex: Math.max(0, Number(pick("month")) - 1),
    year: pick("year"),
    time: `${pick("hour")}:${pick("minute")}`
  };
}

function localizedDate(parts: ReturnType<typeof tashkentParts>, language: Language, includeYear: boolean) {
  const month = shortMonths[language][parts.monthIndex] ?? "";
  if (language === "uz") return includeYear ? `${parts.day}-${month}, ${parts.year}` : `${parts.day}-${month}`;
  if (language === "ru") return includeYear ? `${parts.day} ${month} ${parts.year}` : `${parts.day} ${month}`;
  return includeYear ? `${parts.day} ${month} ${parts.year}` : `${parts.day} ${month}`;
}

export function formatArticleDateTime(value?: string | null, language: Language = "uz") {
  if (!value) return missingDate[language];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return missingDate[language];
  const parts = tashkentParts(date);
  return `${localizedDate(parts, language, true)} • ${parts.time}`;
}

export function formatDateCompact(value?: string | null, language: Language = "uz") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = tashkentParts(date);
  return `${localizedDate(parts, language, false)} • ${parts.time}`;
}

export function formatViewsCompact(count = 0, language: Language = "uz") {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount < 1000) return String(safeCount);

  const units = {
    uz: [
      { value: 1_000_000_000, suffix: " mlrd" },
      { value: 1_000_000, suffix: " mln" },
      { value: 1_000, suffix: " ming" }
    ],
    ru: [
      { value: 1_000_000_000, suffix: " \u043c\u043b\u0440\u0434" },
      { value: 1_000_000, suffix: " \u043c\u043b\u043d" },
      { value: 1_000, suffix: " \u0442\u044b\u0441." }
    ],
    en: [
      { value: 1_000_000_000, suffix: "B" },
      { value: 1_000_000, suffix: "M" },
      { value: 1_000, suffix: "K" }
    ]
  } as const;
  const unit = units[language].find((item) => safeCount >= item.value) ?? units[language][2];
  const rounded = Math.round((safeCount / unit.value) * 10) / 10;
  const number = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${language === "en" ? number : number.replace(".", ",")}${unit.suffix}`;
}

export function formatViews(count = 0, language: Language = "uz") {
  const viewLabel = language === "uz" ? "ko'rish" : language === "ru" ? "просмотров" : "views";
  return `${formatViewsCompact(count, language)} ${viewLabel}`;
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
