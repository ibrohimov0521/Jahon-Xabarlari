import { NextResponse } from "next/server";

// Live UZS exchange rates from the Central Bank of Uzbekistan (free, no key).
// Fetched server-side (avoids CORS) and cached; CBU publishes once per business day.
export const revalidate = 3600; // re-fetch at most hourly

const WANTED = ["USD", "EUR", "RUB"] as const;

type CbuItem = {
  Ccy: string;
  Rate: string;
  Diff: string;
  Nominal: string;
  Date: string;
  CcyNm_UZ?: string;
};

export type CurrencyRate = {
  code: string;
  name: string;
  rate: number; // UZS per 1 unit
  diff: number; // daily change in UZS per 1 unit (can be negative)
  date: string;
};

export async function GET() {
  try {
    const res = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/", {
      next: { revalidate },
      headers: { Accept: "application/json" }
    });
    if (!res.ok) throw new Error(`cbu ${res.status}`);
    const data = (await res.json()) as CbuItem[];

    const rates: CurrencyRate[] = WANTED.flatMap((code) => {
      const item = data.find((d) => d.Ccy === code);
      if (!item) return [];
      const nominal = parseFloat(item.Nominal) || 1;
      return [
        {
          code,
          name: item.CcyNm_UZ ?? code,
          rate: (parseFloat(item.Rate) || 0) / nominal,
          diff: (parseFloat(item.Diff) || 0) / nominal,
          date: item.Date
        }
      ];
    });

    return NextResponse.json(
      { rates },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch {
    // Never break the header; the ticker just renders nothing when this is empty.
    return NextResponse.json({ rates: [] as CurrencyRate[] });
  }
}
