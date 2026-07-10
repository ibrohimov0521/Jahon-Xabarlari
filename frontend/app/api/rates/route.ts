import { NextResponse } from "next/server";
import { buildHistory, CURRENCY_CODES, COUNTRY, type CurrencyRate, percentOf, trendOf } from "../../../lib/currency";

// Live UZS exchange rates from the Central Bank of Uzbekistan (free, no key).
// Fetched server-side (avoids CORS) and cached; CBU publishes once per business day.
export const revalidate = 3600;

type CbuItem = { Ccy: string; Rate: string; Diff: string; Nominal: string; Date: string; CcyNm_UZ?: string };

export type { CurrencyRate };

export async function GET() {
  try {
    const res = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/", {
      next: { revalidate },
      headers: { Accept: "application/json" }
    });
    if (!res.ok) throw new Error(`cbu ${res.status}`);
    const data = (await res.json()) as CbuItem[];

    const rates: CurrencyRate[] = CURRENCY_CODES.flatMap((code) => {
      const item = data.find((d) => d.Ccy === code);
      if (!item) return [];
      const nominal = parseFloat(item.Nominal) || 1;
      const rate = (parseFloat(item.Rate) || 0) / nominal;
      const diff = (parseFloat(item.Diff) || 0) / nominal;
      return [
        {
          code,
          name: item.CcyNm_UZ ?? code,
          country: COUNTRY[code] ?? code,
          rate,
          diff,
          percent: percentOf(rate, diff),
          trend: trendOf(diff),
          date: item.Date,
          history: buildHistory(code, rate, diff)
        }
      ];
    });

    return NextResponse.json(
      { updated: rates[0]?.date ?? "", base: "UZS", rates },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch {
    return NextResponse.json({ updated: "", base: "UZS", rates: [] as CurrencyRate[] });
  }
}
