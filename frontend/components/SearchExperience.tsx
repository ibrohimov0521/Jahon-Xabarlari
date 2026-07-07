"use client";

import {
  ArrowUpRight,
  Clock,
  Command,
  Cpu,
  CornerDownLeft,
  Globe2,
  Landmark,
  LineChart,
  MapPin,
  Palette,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
  X,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { MediaView } from "./MediaView";
import { useSearch } from "../lib/search-context";
import { useUi } from "../lib/ui-context";
import { searchArticles, getArticles, type Article } from "../lib/api";
import { formatArticleDateTime, formatViews } from "../lib/format";

type Cat = { slug: string; key: string; icon: ComponentType<{ size?: number }> };

const CATEGORIES: Cat[] = [
  { slug: "", key: "all", icon: Sparkles },
  { slug: "ozbekiston", key: "uzbekistan", icon: MapPin },
  { slug: "dunyo", key: "world", icon: Globe2 },
  { slug: "siyosat", key: "politics", icon: Landmark },
  { slug: "iqtisodiyot", key: "economy", icon: LineChart },
  { slug: "texnologiya", key: "technology", icon: Cpu },
  { slug: "sport", key: "sport", icon: Trophy },
  { slug: "madaniyat", key: "culture", icon: Palette }
];

const TRENDING = ["Sun'iy intellekt", "Jahon iqtisodiyoti", "Chempionlar ligasi", "Neft narxi", "Iqlim sammiti", "Valyuta kursi", "Kosmik missiya", "Saylov natijalari"];

const STR = {
  placeholder: { uz: "Yangilik qidiring...", ru: "Искать новости...", en: "Search news..." },
  cancel: { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" },
  all: { uz: "Barchasi", ru: "Все", en: "All" },
  trending: { uz: "Omma qidirayotganlar", ru: "Популярные запросы", en: "Trending searches" },
  recent: { uz: "So'nggi qidiruvlar", ru: "Недавние запросы", en: "Recent searches" },
  clear: { uz: "Tozalash", ru: "Очистить", en: "Clear" },
  categories: { uz: "Bo'limlar", ru: "Разделы", en: "Categories" },
  breaking: { uz: "So'nggi xabarlar", ru: "Срочные новости", en: "Breaking news" },
  recommended: { uz: "Tavsiya etilgan", ru: "Рекомендуем", en: "Recommended" },
  results: { uz: "Natijalar", ru: "Результаты", en: "Results" },
  noResults: { uz: "Hech narsa topilmadi", ru: "Ничего не найдено", en: "No results found" },
  noResultsHint: { uz: "Boshqa so'z bilan qidirib ko'ring yoki ommabop so'rovlardan tanlang.", ru: "Попробуйте другой запрос или популярные темы.", en: "Try another term or pick a popular search." },
  assistant: { uz: "Qidiruv markazi", ru: "Центр поиска", en: "Search center" }
};

const RECENT_KEY = "jx_recent_searches";

function pick<T extends Record<string, string>>(map: T, lang: string) {
  return map[lang] ?? map.uz;
}

function highlight(text: string, q: string) {
  const query = q.trim();
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="se-mark">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function SearchExperience() {
  const { open, closeSearch } = useSearch();
  const { t, language } = useUi();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<Article[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pool, setPool] = useState<Article[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const poolLoaded = useRef(false);

  // Mount / unmount with enter+exit transition.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), 280);
    return () => clearTimeout(timer);
  }, [open]);

  // Focus, scroll-lock, load recents, prefetch a content pool once.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 120);
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
    } catch {
      setRecent([]);
    }
    if (!poolLoaded.current) {
      poolLoaded.current = true;
      getArticles("", language === "uz" ? undefined : language).then((items) => setPool(items.slice(0, 30)));
    }
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(focusTimer);
    };
  }, [open, language]);

  // Debounce the query.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 240);
    return () => clearTimeout(id);
  }, [query]);

  // Live search on debounced query.
  useEffect(() => {
    if (debounced.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchArticles(debounced, language === "uz" ? undefined : language).then((items) => {
      if (cancelled) return;
      setResults(items);
      setLoading(false);
      setActive(-1);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, language]);

  // Reset transient state each time it opens.
  useEffect(() => {
    if (open) return;
    setQuery("");
    setDebounced("");
    setResults(null);
    setCategory("");
    setActive(-1);
  }, [open]);

  const filtered = useMemo(() => {
    const base = results ?? [];
    if (!category) return base;
    return base.filter((a) => a.category?.slug === category || a.category?.name?.toLowerCase().includes(category));
  }, [results, category]);

  const poolFiltered = useMemo(() => {
    if (!category) return pool;
    return pool.filter((a) => a.category?.slug === category || a.category?.name?.toLowerCase().includes(category));
  }, [pool, category]);

  const hasQuery = debounced.length >= 2;
  const centerList = hasQuery ? filtered : poolFiltered;

  function saveRecent(term: string) {
    const value = term.trim();
    if (!value) return;
    const next = [value, ...recent.filter((r) => r.toLowerCase() !== value.toLowerCase())].slice(0, 8);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  }

  function removeRecent(term: string) {
    const next = recent.filter((r) => r !== term);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  }

  function clearRecent() {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {}
  }

  function runTerm(term: string) {
    setQuery(term);
    saveRecent(term);
    inputRef.current?.focus();
  }

  function openArticle(a: Article) {
    saveRecent(query || a.title);
    closeSearch();
    router.push(`/articles/${a.slug}`);
  }

  // Keyboard navigation within results.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
      return;
    }
    if (!centerList.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, centerList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      openArticle(centerList[active]);
    }
  }

  if (!mounted) return null;

  const chip = (c: Cat, i: number) => {
    const label = c.key === "all" ? pick(STR.all, language) : t.nav[c.key as keyof typeof t.nav];
    const Icon = c.icon;
    const activeChip = category === c.slug;
    return (
      <button
        key={c.slug || "all"}
        onClick={() => setCategory(c.slug)}
        className={`se-chip ${activeChip ? "is-active" : ""}`}
        style={{ animationDelay: `${90 + i * 45}ms` }}
      >
        <Icon size={15} />
        {label}
      </button>
    );
  };

  const resultCard = (a: Article, i: number, big: boolean) => (
    <button
      key={a.id}
      onClick={() => openArticle(a)}
      onMouseEnter={() => setActive(i)}
      className={`se-card ${active === i ? "is-active" : ""} ${big ? "se-card-lg" : ""}`}
      style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
    >
      <MediaView src={a.mainImage} className={`se-card-img ${big ? "" : "se-card-img-sm"}`} />
      <div className="se-card-body">
        <span className="se-card-cat">{a.category?.name}</span>
        <h4 className="se-card-title">{hasQuery ? highlight(a.title, debounced) : a.title}</h4>
        {big && a.summary ? <p className="se-card-sum">{hasQuery ? highlight(a.summary, debounced) : a.summary}</p> : null}
        <div className="se-card-meta">
          {a.publishedAt ? <span>{formatArticleDateTime(a.publishedAt)}</span> : null}
          <span>👁 {formatViews(a.viewsCount)}</span>
        </div>
      </div>
      <ArrowUpRight className="se-card-arrow" size={18} />
    </button>
  );

  const trendingBlock = (
    <section className="se-block">
      <div className="se-block-head"><TrendingUp size={16} /> {pick(STR.trending, language)}</div>
      <div className="se-trend-list">
        {TRENDING.map((term, i) => (
          <button key={term} onClick={() => runTerm(term)} className="se-trend" style={{ animationDelay: `${120 + i * 55}ms` }}>
            <span className="se-trend-rank">{i + 1}</span>
            <span className="se-trend-term">{term}</span>
            <ArrowUpRight className="se-trend-arrow" size={16} />
          </button>
        ))}
      </div>
    </section>
  );

  const recentBlock = recent.length > 0 && (
    <section className="se-block">
      <div className="se-block-head">
        <Clock size={16} /> {pick(STR.recent, language)}
        <button onClick={clearRecent} className="se-clear">{pick(STR.clear, language)}</button>
      </div>
      <div className="se-recent-list">
        {recent.map((term) => (
          <div key={term} className="se-recent">
            <Clock size={15} className="se-recent-ico" />
            <button onClick={() => runTerm(term)} className="se-recent-term">{term}</button>
            <button aria-label="delete" onClick={() => removeRecent(term)} className="se-recent-del"><X size={15} /></button>
          </div>
        ))}
      </div>
    </section>
  );

  const emptyState = (
    <div className="se-empty">
      <div className="se-empty-badge"><Search size={30} /></div>
      <h3 className="se-empty-title">{pick(STR.noResults, language)}</h3>
      <p className="se-empty-sub">{pick(STR.noResultsHint, language)}</p>
      <div className="se-empty-chips">
        {TRENDING.slice(0, 4).map((term) => (
          <button key={term} onClick={() => runTerm(term)} className="se-chip is-ghost">{term}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`se-overlay ${shown ? "is-open" : ""}`} onMouseDown={closeSearch} role="dialog" aria-modal="true">
      <div className="se-panel" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        {/* Header: search field */}
        <div className="se-header">
          <div className="se-field">
            <Search size={20} className="se-field-ico" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={pick(STR.placeholder, language)}
              className="se-input"
              enterKeyHint="search"
            />
            {query && (
              <button aria-label="clear" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="se-field-clear">
                <X size={16} />
              </button>
            )}
          </div>
          <button onClick={closeSearch} className="se-cancel">{pick(STR.cancel, language)}</button>
          <div className="se-kbd-hints">
            <kbd className="se-kbd">ESC</kbd>
            <kbd className="se-kbd"><Command size={11} /> K</kbd>
          </div>
        </div>

        {/* Mobile category chips */}
        <div className="se-chips lg:hidden">{CATEGORIES.map(chip)}</div>

        {/* Body */}
        <div className="se-body">
          {/* Desktop left sidebar */}
          <aside className="se-side">
            <div className="se-side-title">{pick(STR.categories, language)}</div>
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const label = c.key === "all" ? pick(STR.all, language) : t.nav[c.key as keyof typeof t.nav];
              return (
                <button key={c.slug || "all"} onClick={() => setCategory(c.slug)} className={`se-side-item ${category === c.slug ? "is-active" : ""}`}>
                  <Icon size={18} />
                  {label}
                </button>
              );
            })}
          </aside>

          {/* Center */}
          <main className="se-center">
            {loading && <div className="se-loading" />}
            {hasQuery ? (
              filtered.length > 0 ? (
                <>
                  <div className="se-center-head">{pick(STR.results, language)} · {filtered.length}</div>
                  <div className="se-results">{filtered.map((a, i) => resultCard(a, i, true))}</div>
                </>
              ) : (
                !loading && emptyState
              )
            ) : (
              <>
                {/* Mobile-only trending + recent live in the center */}
                <div className="lg:hidden">
                  {trendingBlock}
                  {recentBlock}
                </div>
                {/* Recommended content pool */}
                {poolFiltered.length > 0 && (
                  <section className="se-block">
                    <div className="se-block-head"><Sparkles size={16} /> {pick(STR.recommended, language)}</div>
                    <div className="se-results">{poolFiltered.slice(0, 8).map((a, i) => resultCard(a, i, true))}</div>
                  </section>
                )}
              </>
            )}
          </main>

          {/* Desktop right assistant panel */}
          <aside className="se-assistant">
            <div className="se-assistant-title"><Zap size={15} /> {pick(STR.assistant, language)}</div>
            {trendingBlock}
            {pool.length > 0 && (
              <section className="se-block">
                <div className="se-block-head"><Zap size={16} /> {pick(STR.breaking, language)}</div>
                <div className="se-mini-list">
                  {pool.slice(0, 4).map((a) => (
                    <button key={a.id} onClick={() => openArticle(a)} className="se-mini">
                      <span className="se-mini-dot" />
                      <span className="se-mini-title">{a.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {recentBlock}
          </aside>
        </div>
      </div>
    </div>
  );
}
