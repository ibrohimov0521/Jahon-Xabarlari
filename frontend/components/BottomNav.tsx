"use client";

import {
  Award,
  Bookmark,
  ChevronRight,
  Cpu,
  Globe2,
  Home,
  Info,
  Landmark,
  LineChart,
  MapPin,
  Megaphone,
  Menu,
  Newspaper,
  Palette,
  Phone,
  Search,
  TrendingUp,
  Trophy,
  X,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSearch } from "../lib/search-context";
import { useUi } from "../lib/ui-context";

const categoryKeys: { key: string; href: string; icon: LucideIcon }[] = [
  { key: "uzbekistan", href: "/category/ozbekiston", icon: MapPin },
  { key: "world", href: "/category/dunyo", icon: Globe2 },
  { key: "politics", href: "/category/siyosat", icon: Landmark },
  { key: "economy", href: "/category/iqtisodiyot", icon: LineChart },
  { key: "technology", href: "/category/texnologiya", icon: Cpu },
  { key: "sport", href: "/category/sport", icon: Trophy },
  { key: "culture", href: "/category/madaniyat", icon: Palette }
];

const moreKeys: { key: string; href: string; icon: LucideIcon }[] = [
  { key: "popular", href: "/popular", icon: TrendingUp },
  { key: "editor", href: "/editor-choice", icon: Award },
  { key: "about", href: "/about", icon: Info },
  { key: "ads", href: "/ads", icon: Megaphone },
  { key: "contact", href: "/contact", icon: Phone }
];

const LABELS = {
  news: { uz: "Yangiliklar", ru: "Новости", en: "News" },
  search: { uz: "Qidiruv", ru: "Поиск", en: "Search" },
  saved: { uz: "Saqlangan", ru: "Сохранённые", en: "Saved" },
  menu: { uz: "Menyu", ru: "Меню", en: "Menu" },
  sections: { uz: "Bo'limlar", ru: "Разделы", en: "Sections" },
  savedEmpty: { uz: "Hozircha saqlangan yangilik yo'q.", ru: "Пока нет сохранённых новостей.", en: "No saved news yet." }
} as const;

type Lang = "uz" | "ru" | "en";
type Sheet = "categories" | "more" | "saved" | null;

const pick = (map: { uz: string; ru: string; en: string }, lang: string) => map[(lang as Lang)] ?? map.uz;

/**
 * Mobile-only bottom dock (hidden on lg+): Home · News · [Search] · Saved · Menu.
 * The centre Search is a raised, glowing blue circle — the signature action.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const { t, language } = useUi();
  const { openSearch, closeSearch, open: searchOpen } = useSearch();
  const [sheet, setSheet] = useState<Sheet>(null);

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  // Only ONE tab is active at a time. While the Search overlay is open, Search
  // owns the active state; otherwise it follows the current page / open sheet.
  const isNewsPath = pathname.startsWith("/category") || pathname.startsWith("/popular");
  const isMorePath = moreKeys.some((item) => pathname.startsWith(item.href));

  // Exactly one active: Search (overlay) > open sheet > current page.
  const noOverlay = !searchOpen && !sheet;
  const homeActive = noOverlay && pathname === "/";
  const newsActive = !searchOpen && (sheet === "categories" || (!sheet && isNewsPath));
  const savedActive = !searchOpen && sheet === "saved";
  const menuActive = !searchOpen && (sheet === "more" || (!sheet && isMorePath));

  const sheetTitle =
    sheet === "categories" ? pick(LABELS.sections, language) : sheet === "more" ? t.nav.more : sheet === "saved" ? pick(LABELS.saved, language) : "";

  return (
    <>
      <nav className="bottom-nav lg:hidden" aria-label="Mobil navigatsiya">
        <Link
          href="/"
          onClick={() => {
            closeSearch();
            setSheet(null);
          }}
          className={`bottom-nav-item ${homeActive ? "is-active" : ""}`}
        >
          <span className="bottom-nav-ico"><Home size={21} strokeWidth={2.2} /></span>
          {t.nav.home}
        </Link>

        <button
          type="button"
          onClick={() => {
            closeSearch();
            setSheet((s) => (s === "categories" ? null : "categories"));
          }}
          className={`bottom-nav-item ${newsActive ? "is-active" : ""}`}
        >
          <span className="bottom-nav-ico"><Newspaper size={21} strokeWidth={2.2} /></span>
          {pick(LABELS.news, language)}
        </button>

        <button
          type="button"
          onClick={() => {
            setSheet(null);
            openSearch();
          }}
          className={`bottom-nav-item is-search ${searchOpen ? "is-active" : ""}`}
        >
          <span className="bottom-nav-ico"><Search size={23} strokeWidth={2.5} /></span>
          {pick(LABELS.search, language)}
        </button>

        <button
          type="button"
          onClick={() => {
            closeSearch();
            setSheet((s) => (s === "saved" ? null : "saved"));
          }}
          className={`bottom-nav-item ${savedActive ? "is-active" : ""}`}
        >
          <span className="bottom-nav-ico"><Bookmark size={20} strokeWidth={2.2} /></span>
          {pick(LABELS.saved, language)}
        </button>

        <button
          type="button"
          onClick={() => {
            closeSearch();
            setSheet((s) => (s === "more" ? null : "more"));
          }}
          className={`bottom-nav-item ${menuActive ? "is-active" : ""}`}
        >
          <span className="bottom-nav-ico"><Menu size={21} strokeWidth={2.2} /></span>
          {pick(LABELS.menu, language)}
        </button>
      </nav>

      {sheet && (
        <>
          <div className="bottom-sheet-overlay lg:hidden" onClick={() => setSheet(null)} />
          <div className="bottom-sheet lg:hidden" role="dialog" aria-label={sheetTitle}>
            <div className="sheet-handle" />
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="sheet-title">{sheetTitle}</h3>
              <button aria-label="Yopish" onClick={() => setSheet(null)} className="sheet-close">
                <X size={18} />
              </button>
            </div>

            {sheet === "saved" ? (
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                <span className="grid size-16 place-items-center rounded-2xl bg-white/5 text-slate-400"><Bookmark size={28} /></span>
                <p className="text-sm text-slate-400">{pick(LABELS.savedEmpty, language)}</p>
              </div>
            ) : (
              <div className="sheet-grid">
                {(sheet === "categories" ? categoryKeys : moreKeys).map((item, i) => {
                  const Icon = item.icon;
                  const label = sheet === "categories" ? t.nav[item.key as keyof typeof t.nav] : t.more[item.key as keyof typeof t.more];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSheet(null)}
                      className={`sheet-card ${pathname.startsWith(item.href) ? "is-active" : ""}`}
                      style={{ animationDelay: `${i * 45}ms` }}
                    >
                      <span className="sheet-card-ico"><Icon size={20} /></span>
                      <span className="sheet-card-title">{label}</span>
                      <ChevronRight size={18} className="sheet-card-arrow" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
