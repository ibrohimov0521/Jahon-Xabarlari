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

// Deterministic 7-point sparkline series ending at the current rate and drifting in the
// direction of today's change. Illustrative until real CBU history is wired in -- the API
// shape already carries `history`, so swapping to real data is a route-only change.
export function buildHistory(code: string, rate: number, diff: number): number[] {
  let seed = [...code].reduce((a, c) => a + c.charCodeAt(0), 0) * 131 + 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const span = Math.abs(diff) * 3.2 || rate * 0.004;
  const start = rate - (diff >= 0 ? span : -span) * 0.9;
  const out: number[] = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const base = start + (rate - start) * t;
    const noise = i === 6 ? 0 : (rnd() - 0.5) * span * 0.5;
    out.push(Math.round((base + noise) * 100) / 100);
  }
  out[6] = rate;
  return out;
}
