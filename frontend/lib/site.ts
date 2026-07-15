const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://jahonxabarlari.uz";

export const SITE_URL = configuredSiteUrl
  .replace(/^http:\/\/(?:www\.)?jahonxabarlari\.uz/i, "https://jahonxabarlari.uz")
  .replace(/^https:\/\/www\.jahonxabarlari\.uz/i, "https://jahonxabarlari.uz")
  .replace(/\/$/, "");

export const SITE_NAME = "Jahon Xabarlari";
export const SITE_FULL_NAME = "Jahon Xabarlari";
export const SITE_ALTERNATE_NAME = "JX";
export const SITE_TAGLINE = "Yangilik. AI. Hayot.";
export const SITE_TITLE = "Jahon Xabarlari - O'zbekiston va Dunyo Yangiliklari";
export const SITE_DESCRIPTION = "Jahon Xabarlari - O'zbekiston va dunyodagi eng muhim yangiliklarni tezkor, ishonchli va xolis yorituvchi yangiliklar portali.";
export const SITE_KEYWORDS = [
  "JX",
  "JX Jahon Xabarlari",
  "Jahon Xabarlari",
  "yangiliklar",
  "AI yangiliklar",
  "ob-havo",
  "valyuta kurslari",
  "O'zbekiston yangiliklari",
  "dunyo yangiliklari",
  "siyosat",
  "iqtisodiyot",
  "texnologiya",
  "sport",
  "madaniyat",
  "tezkor xabarlar"
];
// Visible header logo — optimized 256px mark (was a 2.3 MB 1254px PNG).
export const SITE_LOGO = "/brand/logo-mark.png";
// Square logo used for schema.org / Google's brand + favicon signals.
export const SITE_LOGO_SQUARE = "/logo.png";
export const SITE_ICON_192 = "/brand/icon-192.png";
export const SITE_ICON_512 = "/brand/icon-512.png";
export const SITE_OG_IMAGE = "/brand/og-logo.png";
export const SITE_SOCIAL_LINKS = ["https://t.me/jahonxabarlari", "https://facebook.com/jahonxabarlari", "https://instagram.com/jahonxabarlari", "https://youtube.com/@jahonxabarlari"];
