"use client";

import { useMemo, useState } from "react";
import type { Article } from "../lib/api";
import { NewsCard } from "./NewsCard";

type SupportedLanguage = "uz" | "ru" | "en";

type CategoryFilter = {
  label: string;
  slug: string;
};

export function HomeLatestGrid({
  articles,
  categories,
  language,
  title,
  emptyLabel
}: {
  articles: Article[];
  categories: CategoryFilter[];
  language: SupportedLanguage;
  title: string;
  emptyLabel: string;
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const visibleArticles = useMemo(() => {
    const filtered =
      activeCategory === "all"
        ? articles
        : articles.filter((article) => article.category?.slug === activeCategory);
    return filtered.slice(0, 12);
  }, [activeCategory, articles]);

  return (
    <div className="home-latest-block lg:col-span-2">
      <div className="home-section-head mb-4 flex flex-wrap items-center gap-2">
        <h2 className="section-title mr-auto text-[27px] font-black">{title}</h2>
        {categories.map((category) => {
          const active = activeCategory === category.slug;
          return (
            <button
              key={category.slug}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveCategory(category.slug)}
              className={`home-filter-chip flex h-9 items-center rounded-full border px-4 text-[13px] font-bold transition ${
                active
                  ? "is-active border-brand bg-brand text-white shadow-lg shadow-blue-500/20"
                  : "border-slate-200 bg-white text-ink hover:border-brand hover:text-brand"
              }`}
            >
              {category.label}
            </button>
          );
        })}
      </div>
      {visibleArticles.length ? (
        <div className="home-news-grid grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {visibleArticles.map((article) => (
            <NewsCard key={article.id} article={article} language={language} />
          ))}
        </div>
      ) : (
        <p className="home-empty-state rounded-lg border border-cyan-300/15 bg-white/6 p-4 text-sm font-bold text-slate-300">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}
