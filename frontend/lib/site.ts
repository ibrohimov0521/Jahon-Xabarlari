const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://jahonxabarlari.uz";

export const SITE_URL = configuredSiteUrl
  .replace(/^http:\/\/(?:www\.)?jahonxabarlari\.uz/i, "https://jahonxabarlari.uz")
  .replace(/^https:\/\/www\.jahonxabarlari\.uz/i, "https://jahonxabarlari.uz")
  .replace(/\/$/, "");

export const SITE_NAME = "BEST TEAM NEWS";
export const SITE_CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "admin@bestteam.uz";
export const SITE_FULL_NAME = "BEST TEAM NEWS";
export const SITE_ALTERNATE_NAME = "BEST TEAM";
export const SITE_TAGLINE = "Tezkor. Ishonchli. Muhim.";
export const SITE_TITLE = "BEST TEAM NEWS - O'zbekiston va Dunyo Yangiliklari";
export const SITE_DESCRIPTION = "BEST TEAM NEWS - O'zbekiston va dunyodagi muhim yangiliklarni tezkor, ishonchli va xolis yorituvchi yangiliklar portali.";
export const SITE_KEYWORDS = [
  "BEST TEAM NEWS",
  "BEST TEAM",
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
export const SITE_LOGO = "/brand/best-team-mark-v2.png";
// Square logo used for schema.org / Google's brand + favicon signals.
export const SITE_LOGO_SQUARE = "/logo.png";
export const SITE_ICON_192 = "/brand/icon-192.png";
export const SITE_ICON_512 = "/brand/icon-512.png";
export const SITE_OG_IMAGE = "/brand/og-best-team-news.png";
export const SITE_SOCIAL_LINKS: string[] = [];
