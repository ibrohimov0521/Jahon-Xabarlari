"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COUNTRY } from "../../lib/currency";
import { Flag } from "./Flag";

export type CurrencyOption = { code: string; name: string };

export function CurrencySelect({ value, options, onChange }: { value: string; options: CurrencyOption[]; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    const id = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      clearTimeout(id);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="cs-wrap" ref={ref}>
      <button type="button" className="cs-trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <Flag country={COUNTRY[value] ?? value} size={22} />
        <span className="cs-code">{value}</span>
        <ChevronDown size={16} className="cs-chev" />
      </button>

      {open && (
        <div className="cs-menu" role="listbox">
          <div className="cs-search">
            <Search size={15} />
            <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Valyuta qidirish..." aria-label="Valyuta qidirish" />
          </div>
          <div className="cs-list">
            {filtered.map((o) => (
              <button
                key={o.code}
                type="button"
                role="option"
                aria-selected={o.code === value}
                className={`cs-option ${o.code === value ? "is-selected" : ""}`}
                onClick={() => {
                  onChange(o.code);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Flag country={COUNTRY[o.code] ?? o.code} size={20} />
                <span className="cs-opt-code">{o.code}</span>
                <span className="cs-opt-name">{o.name}</span>
              </button>
            ))}
            {!filtered.length && <p className="cs-empty">Topilmadi</p>}
          </div>
        </div>
      )}
    </div>
  );
}
