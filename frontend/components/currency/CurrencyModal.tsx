"use client";

import { ArrowRight, ArrowLeftRight, Landmark, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { COUNTRY, fmt, fmt0, fmtSigned, percentOf, SYMBOL, trendOf, type CurrencyRate } from "../../lib/currency";
import { CurrencySelect, type CurrencyOption } from "./CurrencySelect";
import { Flag } from "./Flag";
import { Sparkline } from "./Sparkline";

const UZS: CurrencyRate = { code: "UZS", name: "O'zbek so'mi", country: "UZ", rate: 1, diff: 0, percent: 0, trend: "flat", date: "", history: [] };

function parseNum(value: string) {
  let v = value.replace(/\s/g, "");
  const firstComma = v.indexOf(",");
  const lastComma = v.lastIndexOf(",");
  const lastDot = v.lastIndexOf(".");
  if (v.includes(",") && v.includes(".")) {
    // Both separators present -> the right-most one is the decimal point.
    if (lastComma > lastDot) v = v.replace(/\./g, "").replace(",", "."); // 1.234,56
    else v = v.replace(/,/g, ""); // 1,234.56
  } else if (v.includes(",")) {
    // Only commas: a single comma with 1-2 trailing digits is a decimal; otherwise thousands.
    const trailing = v.length - lastComma - 1;
    if (firstComma === lastComma && trailing > 0 && trailing <= 2) v = v.replace(",", ".");
    else v = v.replace(/,/g, "");
  }
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// Rates >= 1 show 2 decimals; sub-1 rates (e.g. UZS -> USD) show significant digits so they
// don't collapse to "0".
const fmtSmart = (n: number) =>
  n >= 1 || n === 0 ? fmt(n) : new Intl.NumberFormat("uz-UZ", { maximumSignificantDigits: 4 }).format(n);

export function CurrencyModal({
  rates,
  updated,
  initialCode,
  onClose,
  onRefresh
}: {
  rates: CurrencyRate[];
  updated: string;
  initialCode: string;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const byCode = useMemo(() => {
    const map = new Map<string, CurrencyRate>();
    [UZS, ...rates].forEach((r) => map.set(r.code, r));
    return map;
  }, [rates]);

  const options: CurrencyOption[] = useMemo(() => [UZS, ...rates].map((r) => ({ code: r.code, name: r.name })), [rates]);

  const [from, setFrom] = useState(initialCode);
  const [to, setTo] = useState("UZS");
  const [amount, setAmount] = useState("1");
  const [result, setResult] = useState("");
  const [spin, setSpin] = useState(false);

  const rateOf = (code: string) => byCode.get(code)?.rate ?? 1;
  const convert = (val: number, f: string, t: string) => (val * rateOf(f)) / rateOf(t);

  // Recompute the result whenever the amount or either currency changes.
  useEffect(() => {
    const v = convert(parseNum(amount), from, to);
    setResult(amount === "" ? "" : (Number.isInteger(v) ? fmt0(v) : fmt(v)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, from, to, byCode]);

  function onResult(value: string) {
    setResult(value);
    const v = convert(parseNum(value), to, from);
    setAmount(value === "" ? "" : fmt(v));
  }

  function swap() {
    setSpin(true);
    setTimeout(() => setSpin(false), 420);
    setFrom(to);
    setTo(from);
    setAmount(result || "1");
  }

  // Esc + scroll lock while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fromRate = byCode.get(from);
  const oneRate = convert(1, from, to);
  const liveTrend = from === "UZS" ? "flat" : fromRate?.trend ?? "flat";
  const liveDiff = from === "UZS" ? 0 : fromRate?.diff ?? 0;
  const livePct = from === "UZS" ? 0 : fromRate?.percent ?? 0;

  return (
    <div className="cm-pop" role="dialog" aria-label="Valyuta konvertori" aria-modal="true">
      <div className="cm-arrow" aria-hidden="true" />
      <div className="cm-head">
        <span className="cm-title">
          <span className="cm-badge">$</span> Valyuta konvertori
        </span>
        <div className="cm-head-right">
          <span className="cm-updated">Oxirgi yangilanish: {updated || "—"}</span>
          <button className={`cm-icon ${spin ? "is-spin" : ""}`} onClick={() => { setSpin(true); setTimeout(() => setSpin(false), 600); onRefresh?.(); }} aria-label="Yangilash">
            <RefreshCw size={15} />
          </button>
          <button className="cm-icon" onClick={onClose} aria-label="Yopish">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="cm-body">
        <div className="cm-left">
          <div className="cm-convert">
            <div className="cm-panel">
              <span className="cm-panel-label">Siz yuborasiz</span>
              <input className="cm-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-label="Miqdor" />
              <CurrencySelect value={from} options={options} onChange={setFrom} />
            </div>

            <button className={`cm-swap ${spin ? "is-spin" : ""}`} onClick={swap} aria-label="Valyutalarni almashtirish">
              <ArrowLeftRight size={18} />
            </button>

            <div className="cm-panel is-result">
              <span className="cm-panel-label">Siz olasiz</span>
              <input className="cm-amount" inputMode="decimal" value={result} onChange={(e) => onResult(e.target.value)} placeholder="0" aria-label="Natija" />
              <CurrencySelect value={to} options={options} onChange={setTo} />
            </div>
          </div>

          <div className="cm-live">
            <span className="cm-live-rate">
              1 {from} = {fmtSmart(oneRate)} {to}
            </span>
            <span className={`cm-live-diff is-${liveTrend}`}>
              {liveTrend === "up" ? "▲" : liveTrend === "down" ? "▼" : "•"} {fmtSigned(liveDiff)} ({livePct >= 0 ? "+" : ""}{livePct.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="cm-right">
          <div className="cm-right-head">
            <span>Bugungi kurslar</span>
            <span className="cm-right-sub">1 birlik = UZS</span>
          </div>
          <div className="cm-rows">
            {rates.map((r) => (
              <button key={r.code} type="button" className="cm-row" onClick={() => { setFrom(r.code); setTo("UZS"); setAmount("1"); }}>
                <Flag country={r.country} size={24} />
                <span className="cm-row-id">
                  <span className="cm-row-code">{r.code}</span>
                  <span className="cm-row-name">{r.name}</span>
                </span>
                <span className="cm-row-vals">
                  <span className="cm-row-rate">{fmt(r.rate)}</span>
                  <span className={`cm-row-diff is-${r.trend}`}>
                    {r.trend === "up" ? "▲" : r.trend === "down" ? "▼" : "•"} {fmt(Math.abs(r.diff))}
                  </span>
                </span>
                <Sparkline data={r.history} trend={r.trend} width={54} height={24} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="cm-foot">
        <span className="cm-foot-src">
          <Landmark size={15} /> Ma'lumotlar: O'zbekiston Respublikasi Markaziy banki
        </span>
        <a href="https://cbu.uz/uz/arkhiv-kursov-valyut/" target="_blank" rel="noopener noreferrer" className="cm-foot-all">
          Barcha valyutalarni ko'rish <ArrowRight size={15} />
        </a>
      </div>
    </div>
  );
}
