"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useState } from "react";
import { searchArticlesPage, type Article } from "../lib/api";
import { NewsCard } from "./NewsCard";

type Language = "uz" | "ru" | "en";

const copy = {
  uz: { more: "Yana natijalar", empty: "Mos yangilik topilmadi", failed: "Natijalarni yuklab bo'lmadi. Qayta urinib ko'ring." },
  ru: { more: "Ещё результаты", empty: "Подходящих новостей не найдено", failed: "Не удалось загрузить результаты. Попробуйте снова." },
  en: { more: "More results", empty: "No matching news found", failed: "Results could not be loaded. Please try again." }
} as const;

export function SearchResultsGrid({
  initialItems,
  initialCursor,
  initialHasMore,
  initialFailed,
  q,
  category,
  sort,
  language
}: {
  initialItems: Article[];
  initialCursor: string | null;
  initialHasMore: boolean;
  initialFailed: boolean;
  q: string;
  category: string;
  sort: string;
  language: Language;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(initialFailed);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({ sort, cursor });
    if (category) params.set("category", category);

    const next = await searchArticlesPage(q, language === "uz" ? undefined : language, `&${params}`);
    if (next.failed) {
      setFailed(true);
    } else {
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...next.items.filter((item) => !known.has(item.id))];
      });
      setCursor(next.nextCursor);
      setHasMore(next.hasMore);
    }
    setLoading(false);
  }

  if (!items.length && !loading && !failed) {
    return <p className="home-empty-state mt-6 rounded-lg border border-cyan-300/15 bg-white/6 p-5 text-sm font-bold text-slate-300">{copy[language].empty}</p>;
  }

  return (
    <>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => <NewsCard key={item.id} article={item} language={language} />)}
      </div>
      {failed && <p className="mt-4 text-center text-sm font-bold text-red-400">{copy[language].failed}</p>}
      {hasMore && cursor && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadMore()}
          className="home-outline-action mx-auto mt-6 flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-black text-ink transition hover:border-brand hover:text-brand disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />}
          {copy[language].more}
        </button>
      )}
    </>
  );
}
