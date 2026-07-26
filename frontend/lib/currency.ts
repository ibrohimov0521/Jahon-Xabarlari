// Shared, server-safe currency helpers + metadata (no browser APIs) used by the API route,
// the header ticker and the converter modal.

export type Trend = "up" | "down" | "flat";

export type CurrencyRate = {
  code: string;
  name: string; // Uzbek full name
  country: string; // ISO-ish key for the <Flag/> component
  rate: number; // UZS per 1 unit
  diff: number; // daily change in UZS per 1 unit (signed)
  percent: number; // daily change %
  trend: Trend;
  date: string;
  history: number[]; // 7-point series for the sparkline (ends at `rate`)
};

// Currencies surfaced in the modal (favourites first). Add here to grow coverage.
export const CURRENCY_CODES = ["USD", "EUR", "RUB", "CNY", "GBP", "JPY", "KZT", "TRY", "AED", "SAR", "KRW", "INR", "CHF"] as const;

// The three shown in the compact header ticker.
export const TICKER_CODES = ["USD", "EUR", "RUB"] as const;

export const COUNTRY: Record<string, string> = {
  USD: "US", EUR: "EU", RUB: "RU", CNY: "CN", GBP: "GB", JPY: "JP",
  KZT: "KZ", TRY: "TR", AED: "AE", SAR: "SA", KRW: "KR", INR: "IN", CHF: "CH", UZS: "UZ"
};

export const SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", RUB: "₽", CNY: "¥", GBP: "£", JPY: "¥", UZS: "so'm",
  KZT: "₸", TRY: "₺", AED: "د.إ", SAR: "﷼", KRW: "₩", INR: "₹", CHF: "₣"
};

export const trendOf = (diff: number): Trend => (diff > 0 ? "up" : diff < 0 ? "down" : "flat");
export const percentOf = (rate: number, diff: number) => {
  const prev = rate - diff;
  return prev ? (diff / prev) * 100 : 0;
};

const nf = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 });
export const fmt = (n: number) => nf.format(n);
export const fmt0 = (n: number) => nf0.format(n);
export const fmtSigned = (n: number) => (n >= 0 ? "+" : "") + nf.format(n);

// CBU exposes the current rate and its previous-day difference in this endpoint. Keep the
// sparkline honest by drawing only those two real points instead of inventing a fake week.
export function buildHistory(_code: string, rate: number, diff: number): number[] {
  return [Math.round((rate - diff) * 100) / 100, Math.round(rate * 100) / 100];
}
