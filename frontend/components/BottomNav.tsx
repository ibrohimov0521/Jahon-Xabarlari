"use client";

import {
  Award,
  BellRing,
  CircleDollarSign,
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
import { useEffect } from "react";
import { useNav } from "../lib/nav-context";
import { useSearch } from "../lib/search-context";
import { useUi } from "../lib/ui-context";
import { openMobileCurrency } from "./MobileCurrency";
import { openPushSettings } from "./PushNotifications";

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
  { key: "editor", href: "/editor-choice", icon: Award },
  { key: "about", href: "/about", icon: Info },
  { key: "ads", href: "/ads", icon: Megaphone },
  { key: "contact", href: "/contact", icon: Phone }
];

const LABELS = {
  news: { uz: "Yangiliklar", ru: "Новости", en: "News" },
  search: { uz: "Qidiruv", ru: "Поиск", en: "Search" },
  menu: { uz: "Menyu", ru: "Меню", en: "Menu" },
  sections: { uz: "Bo'limlar", ru: "Разделы", en: "Sections" }
} as const;

const POPULAR_LABELS = { uz: "Mashhur", ru: "Популярное", en: "Popular" } as const;

type Lang = "uz" | "ru" | "en";

const pick = (map: { uz: string; ru: string; en: string }, lang: string) => map[(lang as Lang)] ?? map.uz;

/**
 * Mobile-only bottom dock (hidden on lg+): Home · News · [Search] · Popular · Menu.
 * The centre Search is a raised, glowing blue circle — the signature action.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const { t, language } = useUi();
  const { openSearch, closeSearch, open: searchOpen } = useSearch();
  const { sheet, setSheet } = useNav();

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(null);
    };
    document.body.classList.add("mobile-nav-sheet-open");
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("mobile-nav-sheet-open");
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [setSheet, sheet]);

  // Only ONE tab is active at a time. While the Search overlay is open, Search
  // owns the active state; otherwise it follows the current page / open sheet.
  const isNewsPath = pathname.startsWith("/category") || pathname.startsWith("/articles");
  const isSearchPath = pathname.startsWith("/search");
  const isMorePath = moreKeys.some((item) => pathname.startsWith(item.href));

  // Exactly one active: Search (overlay) > open sheet > current page.
  const searchActive = searchOpen || (!sheet && isSearchPath);
  const noOverlay = !searchActive && !sheet;
  const homeActive = noOverlay && pathname === "/";
  const newsActive = !searchActive && (sheet === "categories" || (!sheet && isNewsPath));
  const popularActive = noOverlay && pathname.startsWith("/popular");
  const menuActive = !searchActive && (sheet === "more" || (!sheet && isMorePath));

  const sheetTitle =
    sheet === "categories" ? pick(LABELS.sections, language) : sheet === "more" ? t.nav.more : "";

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
          aria-current={homeActive ? "page" : undefined}
        >
          <span className="bottom-nav-ico"><Home size={21} strokeWidth={2.2} /></span>
          <span className="bottom-nav-label">{t.nav.home}</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            closeSearch();
            setSheet((s) => (s === "categories" ? null : "categories"));
          }}
          className={`bottom-nav-item ${newsActive ? "is-active" : ""}`}
          aria-expanded={sheet === "categories"}
          aria-controls="mobile-navigation-sheet"
        >
          <span className="bottom-nav-ico"><Newspaper size={21} strokeWidth={2.2} /></span>
          <span className="bottom-nav-label">{pick(LABELS.news, language)}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSheet(null);
            openSearch();
          }}
          className={`bottom-nav-item is-search ${searchActive ? "is-active" : ""}`}
          aria-expanded={searchOpen}
        >
          <span className="bottom-nav-ico"><Search size={23} strokeWidth={2.5} /></span>
          <span className="bottom-nav-label">{pick(LABELS.search, language)}</span>
        </button>

        <Link
          href="/popular"
          onClick={() => {
            closeSearch();
            setSheet(null);
          }}
          className={`bottom-nav-item ${popularActive ? "is-active" : ""}`}
          aria-current={popularActive ? "page" : undefined}
        >
          <span className="bottom-nav-ico"><TrendingUp size={20} strokeWidth={2.2} /></span>
          <span className="bottom-nav-label">{pick(POPULAR_LABELS, language)}</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            closeSearch();
            setSheet((s) => (s === "more" ? null : "more"));
          }}
          className={`bottom-nav-item ${menuActive ? "is-active" : ""}`}
          aria-expanded={sheet === "more"}
          aria-controls="mobile-navigation-sheet"
        >
          <span className="bottom-nav-ico"><Menu size={21} strokeWidth={2.2} /></span>
          <span className="bottom-nav-label">{pick(LABELS.menu, language)}</span>
        </button>
      </nav>

      {sheet && (
        <>
          <button
            type="button"
            className="bottom-sheet-overlay lg:hidden"
            aria-label="Yopish"
            onClick={() => setSheet(null)}
          />
          <div
            id="mobile-navigation-sheet"
            className="bottom-sheet lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={sheetTitle}
          >
            <div className="sheet-handle" />
            <div className="sheet-head">
              <h3 className="sheet-title">{sheetTitle}</h3>
              <button aria-label="Yopish" onClick={() => setSheet(null)} className="sheet-close">
                <X size={18} />
              </button>
            </div>

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
                    aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    <span className="sheet-card-ico"><Icon size={20} /></span>
                    <span className="sheet-card-title">{label}</span>
                    <ChevronRight size={18} className="sheet-card-arrow" />
                  </Link>
                );
              })}
              {sheet === "more" && (
                <button
                  type="button"
                  onClick={() => {
                    setSheet(null);
                    openMobileCurrency();
                  }}
                  className="sheet-card"
                  style={{ animationDelay: `${moreKeys.length * 45}ms` }}
                >
                  <span className="sheet-card-ico"><CircleDollarSign size={20} /></span>
                  <span className="sheet-card-title">{language === "en" ? "Currency" : "Valyuta"}</span>
                  <ChevronRight size={18} className="sheet-card-arrow" />
                </button>
              )}
              {sheet === "more" && (
                <button
                  type="button"
                  onClick={() => {
                    setSheet(null);
                    openPushSettings();
                  }}
                  className="sheet-card"
                  style={{ animationDelay: `${(moreKeys.length + 1) * 45}ms` }}
                >
                  <span className="sheet-card-ico"><BellRing size={20} /></span>
                  <span className="sheet-card-title">{language === "ru" ? "Уведомления" : language === "en" ? "Notifications" : "Bildirishnomalar"}</span>
                  <ChevronRight size={18} className="sheet-card-arrow" />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
