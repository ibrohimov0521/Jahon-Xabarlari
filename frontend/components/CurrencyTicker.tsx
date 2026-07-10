"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CurrencyRate } from "../app/api/rates/route";
import { Flag } from "./currency/Flag";

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", RUB: "₽", CNY: "¥", GBP: "£", JPY: "¥" };
const COUNTRY: Record<string, string> = { USD: "US", EUR: "EU", RUB: "RU", CNY: "CN", GBP: "GB", JPY: "JP", SAR: "SA", UZS: "UZ" };

const nf = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 });

function num(value: string) {
  const n = parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function pctOf(r: CurrencyRate) {
  const prev = r.rate - r.diff;
  return prev ? (r.diff / prev) * 100 : 0;
}

export function CurrencyTicker() {
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [open, setOpen] = useState<string | null>(null);
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
    const id = setInterval(load, 3_600_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

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
    <div ref={ref} className="cx-ticker">
      {rates.map((r) => {
        const dir = r.diff > 0 ? "up" : r.diff < 0 ? "down" : "flat";
        return (
          <button
            key={r.code}
            type="button"
            onClick={() => selectCurrency(r.code)}
            className={`cx-item is-${dir} ${open === r.code ? "is-active" : ""}`}
            aria-label={`${r.code}: ${nf.format(r.rate)} so'm, kalkulyator`}
          >
            <span className="cx-top">
              <Flag country={COUNTRY[r.code] ?? r.code} size={15} />
              <span className="cx-code">{r.code}</span>
            </span>
            <span className="cx-bot" title={`${nf.format(r.rate)} so'm • ${r.diff >= 0 ? "+" : ""}${nf.format(r.diff)} (${pctOf(r).toFixed(2)}%)`}>
              <span className="cx-rate">{nf0.format(r.rate)}</span>
              <span className="cx-chg">{dir === "up" ? "▲" : dir === "down" ? "▼" : "•"}</span>
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
