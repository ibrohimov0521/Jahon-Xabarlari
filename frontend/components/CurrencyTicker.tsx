"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CurrencyRate } from "../app/api/rates/route";

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", RUB: "₽" };

const nf = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 });

function num(value: string) {
  const n = parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function CurrencyTicker() {
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  // Bidirectional converter: one field holds the foreign amount, the other UZS.
  const [amount, setAmount] = useState("1");
  const [uzs, setUzs] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/rates")
        .then((r) => r.json())
        .then((d) => {
          if (alive && Array.isArray(d.rates)) setRates(d.rates);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 3_600_000); // refresh hourly
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Close the calculator on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = useMemo(() => rates.find((r) => r.code === open) ?? null, [rates, open]);

  function selectCurrency(code: string) {
    setOpen((prev) => (prev === code ? null : code));
    const r = rates.find((x) => x.code === code);
    setAmount("1");
    setUzs(r ? nf0.format(r.rate) : "");
  }

  function onAmount(value: string) {
    setAmount(value);
    if (active) setUzs(value === "" ? "" : nf0.format(num(value) * active.rate));
  }
  function onUzs(value: string) {
    setUzs(value);
    if (active) setAmount(value === "" ? "" : nf.format(num(value) / active.rate));
  }

  if (!rates.length) return null;

  return (
    <div ref={ref} className="currency-ticker">
      {rates.map((r) => {
        const dir = r.diff > 0 ? "up" : r.diff < 0 ? "down" : "flat";
        return (
          <button
            key={r.code}
            type="button"
            onClick={() => selectCurrency(r.code)}
            className={`currency-chip is-${dir} ${open === r.code ? "is-active" : ""}`}
            aria-label={`${r.code} kursi va kalkulyator`}
          >
            <span className="cc-code">{r.code}</span>
            <span className="cc-rate">{nf.format(r.rate)}</span>
            <span className="cc-diff">
              <span className="cc-arrow">{dir === "up" ? "▲" : dir === "down" ? "▼" : "•"}</span>
              {nf.format(Math.abs(r.diff))}
            </span>
          </button>
        );
      })}

      {active && (
        <div className="currency-pop" role="dialog">
          <div className="cp-head">
            <span className="cp-code">
              <span className="cp-sym">{SYMBOL[active.code] ?? ""}</span> {active.code}
            </span>
            <span className="cp-rate">1 {active.code} = {nf.format(active.rate)} so'm</span>
          </div>

          <div className="cp-calc">
            <label className="cp-field">
              <span className="cp-unit">{active.code}</span>
              <input inputMode="decimal" value={amount} onChange={(e) => onAmount(e.target.value)} placeholder="0" />
            </label>
            <span className="cp-eq">=</span>
            <label className="cp-field">
              <span className="cp-unit">UZS</span>
              <input inputMode="decimal" value={uzs} onChange={(e) => onUzs(e.target.value)} placeholder="0" />
            </label>
          </div>

          <p className="cp-foot">
            <span className={`cp-trend is-${active.diff > 0 ? "up" : active.diff < 0 ? "down" : "flat"}`}>
              {active.diff > 0 ? "▲" : active.diff < 0 ? "▼" : "•"} {nf.format(Math.abs(active.diff))} so'm
            </span>
            <span className="cp-src">CBU • {active.date}</span>
          </p>
        </div>
      )}
    </div>
  );
}
