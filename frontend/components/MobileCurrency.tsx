"use client";

import { ArrowLeftRight, Check, ChevronDown, ChevronRight, CircleDollarSign, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { COUNTRY, fmt, TICKER_CODES, type CurrencyRate } from "../lib/currency";
import { useUi } from "../lib/ui-context";
import { Flag } from "./currency/Flag";

const CURRENCY_EVENT = "jx:currency-open";
const UZS: CurrencyRate = {
  code: "UZS",
  name: "O'zbek so'mi",
  country: "UZ",
  rate: 1,
  diff: 0,
  percent: 0,
  trend: "flat",
  date: "",
  history: []
};

const COPY = {
  uz: {
    title: "Valyuta kurslari",
    converter: "Konvertor",
    send: "Siz yuborasiz",
    receive: "Siz olasiz",
    today: "Bugungi kurslar",
    updated: "Yangilangan",
    source: "Markaziy bank kurslari",
    open: "Valyuta konvertorini ochish",
    choose: "Valyutani tanlang",
    search: "Valyutani qidirish...",
    empty: "Valyuta topilmadi"
  },
  ru: {
    title: "Kursy valyut",
    converter: "Konverter",
    send: "Vy otpravlyaete",
    receive: "Vy poluchaete",
    today: "Kursy na segodnya",
    updated: "Obnovleno",
    source: "Kursy Tsentralnogo banka",
    open: "Otkryt konverter valyut",
    choose: "Vyberite valyutu",
    search: "Poisk valyuty...",
    empty: "Valyuta ne naydena"
  },
  en: {
    title: "Exchange rates",
    converter: "Converter",
    send: "You send",
    receive: "You receive",
    today: "Today's rates",
    updated: "Updated",
    source: "Central Bank rates",
    open: "Open currency converter",
    choose: "Choose currency",
    search: "Search currencies...",
    empty: "No currencies found"
  }
} as const;

type RatesResponse = { rates?: CurrencyRate[]; updated?: string };
type Lang = keyof typeof COPY;

export function openMobileCurrency() {
  window.dispatchEvent(new Event(CURRENCY_EVENT));
}

function useRates(enabled = true) {
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [updated, setUpdated] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/rates");
      const data = (await response.json()) as RatesResponse;
      if (Array.isArray(data.rates)) {
        setRates(data.rates);
        setUpdated(data.updated ?? "");
      }
    } catch {
      // Keep the current values if a refresh briefly fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { rates, updated, loading, load };
}

function trendMark(rate: CurrencyRate) {
  if (rate.trend === "up") return "+";
  if (rate.trend === "down") return "-";
  return "=";
}

export function MobileCurrencyCard() {
  const { language } = useUi();
  const copy = COPY[(language as Lang) in COPY ? (language as Lang) : "uz"];
  const { rates, loading } = useRates();
  const tickerRates = TICKER_CODES.map((code) => rates.find((rate) => rate.code === code)).filter(Boolean) as CurrencyRate[];

  return (
    <section className="mobile-currency-card" aria-label={copy.title}>
      <button type="button" className="mobile-currency-card-head" onClick={openMobileCurrency} aria-label={copy.open}>
        <span className="mobile-currency-card-title"><CircleDollarSign size={19} />{copy.title}</span>
        <span className="mobile-currency-card-action">{copy.converter}<ChevronRight size={16} /></span>
      </button>
      <div className="mobile-currency-rates" aria-live="polite">
        {tickerRates.map((rate) => (
          <button key={rate.code} type="button" className="mobile-currency-rate" onClick={openMobileCurrency}>
            <span className="mobile-currency-rate-code"><Flag country={rate.country} size={19} />{rate.code}</span>
            <span className="mobile-currency-rate-value">{fmt(rate.rate)}</span>
            <span className={`mobile-currency-rate-trend is-${rate.trend}`}>{trendMark(rate)} {fmt(Math.abs(rate.diff))}</span>
          </button>
        ))}
        {!tickerRates.length && (
          <span className="mobile-currency-loading">{loading ? "Kurslar yuklanmoqda..." : "Kurslar vaqtincha mavjud emas"}</span>
        )}
      </div>
    </section>
  );
}

export function MobileCurrencyExperience() {
  const { language } = useUi();
  const copy = COPY[(language as Lang) in COPY ? (language as Lang) : "uz"];
  const [open, setOpen] = useState(false);
  const { rates, updated, loading, load } = useRates(open);
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("UZS");
  const [amount, setAmount] = useState("1");
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(CURRENCY_EVENT, show);
    return () => window.removeEventListener(CURRENCY_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (picker) setPicker(null);
      else setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, picker]);

  const currencies = useMemo(() => [UZS, ...rates], [rates]);
  const byCode = useMemo(() => new Map(currencies.map((rate) => [rate.code, rate])), [currencies]);
  const numericAmount = Number(amount.replace(/\s/g, "").replace(",", ".")) || 0;
  const result = (numericAmount * (byCode.get(from)?.rate ?? 1)) / (byCode.get(to)?.rate ?? 1);
  const oneRate = (byCode.get(from)?.rate ?? 1) / (byCode.get(to)?.rate ?? 1);
  const featuredRates = TICKER_CODES.map((code) => rates.find((rate) => rate.code === code)).filter(Boolean) as CurrencyRate[];
  const filteredCurrencies = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return currencies;
    return currencies.filter((rate) => rate.code.toLowerCase().includes(term) || rate.name.toLowerCase().includes(term));
  }, [currencies, query]);

  const swap = () => {
    setFrom(to);
    setTo(from);
    setAmount(result ? String(Math.round(result * 100) / 100) : "0");
  };

  const openPicker = (target: "from" | "to") => {
    setQuery("");
    setPicker(target);
  };

  const selectCurrency = (code: string) => {
    if (picker === "from") setFrom(code);
    if (picker === "to") setTo(code);
    setPicker(null);
  };

  const closeConverter = () => {
    setPicker(null);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="mobile-currency-layer" role="presentation">
      <button type="button" className="mobile-currency-backdrop" onClick={closeConverter} aria-label="Yopish" />
      <section className="mobile-currency-sheet" role="dialog" aria-modal="true" aria-label={copy.converter}>
        <div className="mobile-currency-sheet-handle" />
        <header className="mobile-currency-sheet-head">
          <span className="mobile-currency-sheet-icon"><CircleDollarSign size={21} /></span>
          <span>
            <strong>{copy.converter}</strong>
            <small>{copy.source}</small>
          </span>
          <button type="button" className={`mobile-currency-icon-button ${loading ? "is-loading" : ""}`} onClick={() => void load()} aria-label="Yangilash"><RefreshCw size={17} /></button>
          <button type="button" className="mobile-currency-icon-button" onClick={closeConverter} aria-label="Yopish"><X size={18} /></button>
        </header>

        <div className="mobile-currency-sheet-body">
          <div className="mobile-currency-converter">
            <div className="mobile-currency-field">
              <span>{copy.send}</span>
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label={copy.send} />
              <button type="button" className="mobile-currency-select" onClick={() => openPicker("from")} aria-label={`${copy.choose}: ${from}`}>
                <Flag country={COUNTRY[from]} size={22} />
                <strong>{from}</strong>
                <ChevronDown size={15} />
              </button>
            </div>

            <button type="button" className="mobile-currency-swap" onClick={swap} aria-label="Valyutalarni almashtirish"><ArrowLeftRight size={19} /></button>

            <div className="mobile-currency-field is-result">
              <span>{copy.receive}</span>
              <output>{fmt(result)}</output>
              <button type="button" className="mobile-currency-select" onClick={() => openPicker("to")} aria-label={`${copy.choose}: ${to}`}>
                <Flag country={COUNTRY[to]} size={22} />
                <strong>{to}</strong>
                <ChevronDown size={15} />
              </button>
            </div>
          </div>

          <div className="mobile-currency-live">1 {from} = <strong>{fmt(oneRate)} {to}</strong></div>

          <div className="mobile-currency-list-head">
            <strong>{copy.today}</strong>
            {updated && <span>{copy.updated}: {updated}</span>}
          </div>
          <div className="mobile-currency-list">
            {featuredRates.map((rate) => (
              <button key={rate.code} type="button" className="mobile-currency-list-row" onClick={() => { setFrom(rate.code); setTo("UZS"); setAmount("1"); }}>
                <Flag country={rate.country} size={24} />
                <span><strong>{rate.code}</strong><small>{rate.name}</small></span>
                <span className="mobile-currency-list-value"><strong>{fmt(rate.rate)}</strong><small className={`is-${rate.trend}`}>{trendMark(rate)} {fmt(Math.abs(rate.diff))}</small></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {picker && (
        <div className="mobile-currency-picker-layer" role="presentation">
          <button type="button" className="mobile-currency-picker-backdrop" onClick={() => setPicker(null)} aria-label="Yopish" />
          <section className="mobile-currency-picker" role="dialog" aria-modal="true" aria-label={copy.choose}>
            <div className="mobile-currency-sheet-handle" />
            <header className="mobile-currency-picker-head">
              <strong>{copy.choose}</strong>
              <button type="button" className="mobile-currency-icon-button" onClick={() => setPicker(null)} aria-label="Yopish"><X size={18} /></button>
            </header>
            <label className="mobile-currency-picker-search">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} />
            </label>
            <div className="mobile-currency-picker-list">
              {filteredCurrencies.map((rate) => {
                const selected = (picker === "from" ? from : to) === rate.code;
                return (
                  <button key={rate.code} type="button" className={`mobile-currency-picker-option ${selected ? "is-selected" : ""}`} onClick={() => selectCurrency(rate.code)}>
                    <Flag country={rate.country} size={26} />
                    <span><strong>{rate.code}</strong><small>{rate.name}</small></span>
                    {rate.code !== "UZS" && <span className="mobile-currency-picker-rate">{fmt(rate.rate)} UZS</span>}
                    {selected && <Check className="mobile-currency-picker-check" size={18} />}
                  </button>
                );
              })}
              {!filteredCurrencies.length && <p className="mobile-currency-picker-empty">{copy.empty}</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
