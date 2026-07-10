"use client";

import { useEffect, useRef, useState } from "react";
import { fmt0, TICKER_CODES, type CurrencyRate } from "../lib/currency";
import { CurrencyModal } from "./currency/CurrencyModal";
import { Flag } from "./currency/Flag";

export function CurrencyTicker() {
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [updated, setUpdated] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = () =>
    fetch("/api/rates")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.rates)) {
          setRates(d.rates);
          setUpdated(d.updated ?? "");
        }
      })
      .catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(load, 3_600_000);
    return () => clearInterval(id);
  }, []);

  // Close the modal on outside click.
  useEffect(() => {
    if (!openCode) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenCode(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openCode]);

  const tickerRates = TICKER_CODES.map((c) => rates.find((r) => r.code === c)).filter(Boolean) as CurrencyRate[];
  if (!tickerRates.length) return null;

  return (
    <div ref={ref} className="cx-ticker">
      {tickerRates.map((r) => (
        <button
          key={r.code}
          type="button"
          onClick={() => setOpenCode((prev) => (prev === r.code ? null : r.code))}
          className={`cx-item is-${r.trend} ${openCode === r.code ? "is-active" : ""}`}
          aria-label={`${r.code}: ${fmt0(r.rate)} so'm, konvertor`}
        >
          <span className="cx-top">
            <Flag country={r.country} size={18} />
            <span className="cx-code">{r.code}</span>
          </span>
          <span className="cx-bot" title={`${r.rate} so'm • ${r.diff >= 0 ? "+" : ""}${r.diff} (${r.percent.toFixed(2)}%)`}>
            <span className="cx-rate">{fmt0(r.rate)}</span>
            <span className="cx-chg">{r.trend === "up" ? "▲" : r.trend === "down" ? "▼" : "•"}</span>
          </span>
        </button>
      ))}

      {openCode && (
        <CurrencyModal rates={rates} updated={updated} initialCode={openCode} onClose={() => setOpenCode(null)} onRefresh={load} />
      )}
    </div>
  );
}
