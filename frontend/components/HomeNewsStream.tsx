"use client";

import { ArrowRight, LoaderCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Article } from "../lib/api";
import { API_URL } from "../lib/config";
import { timeoutSignal } from "../lib/http";
import { NewsCard } from "./NewsCard";

type Language = "uz" | "ru" | "en";

const copy = {
  uz: { more: "Yana yangiliklar", retry: "Qayta urinish" },
  ru: { more: "Ещё новости", retry: "Повторить" },
  en: { more: "More news", retry: "Try again" }
} as const;

export function HomeNewsStream({
  language,
  title,
  filterLabel,
  pageSize = 20
}: {
  language: Language;
  title: string;
  filterLabel: string;
  pageSize?: number;
}) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(2);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadNext = useCallback(async () => {
    if (loading || page >= pages) return;
    setLoading(true);
    setFailed(false);
    const nextPage = page + 1;
    const langQuery = language === "uz" ? "" : `&lang=${language}`;

    try {
      const response = await fetch(`${API_URL}/articles?page=${nextPage}&limit=${pageSize}${langQuery}`, {
        signal: timeoutSignal(8_000)
      });
      if (!response.ok) throw new Error("Articles request failed");
      const data = (await response.json()) as { items: Article[]; pages?: number };
      const nextItems = data.items.filter((item) => item.showOnHome !== false && item.showInLatest !== false);
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...nextItems.filter((item) => !known.has(item.id))];
      });
      setPage(nextPage);
      setPages(Math.max(nextPage, data.pages ?? nextPage));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [language, loading, page, pageSize, pages]);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || failed || loading || page > 1) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadNext();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [failed, loadNext, loading, page]);

  return (
    <section ref={triggerRef} className="home-progressive-stream min-h-24">
      {!!items.length && (
        <>
          <div className="home-section-head mb-4 flex items-center justify-between gap-3">
            <h2 className="section-title text-[27px] font-black">{title}</h2>
            <Link href="/search" className="home-outline-action flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-ink transition hover:border-brand hover:text-brand">
              {filterLabel} <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {items.map((item) => <NewsCard key={item.id} article={item} language={language} />)}
          </div>
        </>
      )}

      {loading && (
        <div className="flex h-20 items-center justify-center text-brand" aria-label="Loading">
          <LoaderCircle className="animate-spin" size={24} />
        </div>
      )}

      {failed && (
        <button type="button" onClick={() => void loadNext()} className="mx-auto mt-4 flex h-10 items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-5 text-sm font-black text-brand">
          <RotateCcw size={16} /> {copy[language].retry}
        </button>
      )}

      {!loading && !failed && page > 1 && page < pages && (
        <button type="button" onClick={() => void loadNext()} className="home-outline-action mx-auto mt-5 flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-black text-ink transition hover:border-brand hover:text-brand">
          {copy[language].more} <ArrowRight size={16} />
        </button>
      )}
    </section>
  );
}
