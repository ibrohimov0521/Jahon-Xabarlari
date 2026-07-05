"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

const CATEGORIES: [string, string][] = [
  ["", "Barcha bo'limlar"],
  ["ozbekiston", "O'zbekiston"],
  ["dunyo", "Dunyo"],
  ["siyosat", "Siyosat"],
  ["iqtisodiyot", "Iqtisodiyot"],
  ["texnologiya", "Texnologiya"],
  ["sport", "Sport"],
  ["madaniyat", "Madaniyat"]
];

export function SearchFilterForm({ q, category, sort }: { q: string; category: string; sort: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  function submitNow() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (value) params.set(key, String(value));
    }
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      ref={formRef}
      className="news-shadow mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 lg:grid-cols-[minmax(220px,1fr)_200px_190px]"
      onSubmit={(event) => {
        event.preventDefault();
        submitNow();
      }}
    >
      <label className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
        <Search size={20} className="shrink-0 text-brand" />
        <input
          name="q"
          defaultValue={q}
          className="h-12 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-slate-400"
          placeholder="Yangilik qidirish"
        />
      </label>
      <select
        name="category"
        defaultValue={category}
        onChange={submitNow}
        className="h-12 rounded-xl border border-slate-200 bg-white px-3 font-bold text-ink outline-none"
      >
        {CATEGORIES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        name="sort"
        defaultValue={sort}
        onChange={submitNow}
        className="h-12 rounded-xl border border-slate-200 bg-white px-3 font-bold text-ink outline-none"
      >
        <option value="latest">Eng yangilari</option>
        <option value="popular">Ko'p o'qilganlar</option>
      </select>
    </form>
  );
}
