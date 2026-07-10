"use client";

import { ChevronDown, CloudSun, Globe2, Menu, Moon, Search, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { WeatherModal } from "./WeatherModal";
import { useSearch } from "../lib/search-context";
import { Language, useUi } from "../lib/ui-context";
import { SITE_ALTERNATE_NAME, SITE_LOGO, SITE_NAME, SITE_TAGLINE } from "../lib/site";
import { conditionLabel, fetchFullWeather, findRegionByName, nearestRegion, UZ_REGIONS, type FullWeather, type UzRegion } from "../lib/weather";

const navKeys = [
  { key: "home", href: "/" },
  { key: "uzbekistan", href: "/category/ozbekiston" },
  { key: "world", href: "/category/dunyo" },
  { key: "politics", href: "/category/siyosat" },
  { key: "sport", href: "/category/sport" }
] as const;

// Categories moved out of the top nav to keep it compact -- surfaced in the "Ko'proq" menu.
const moreCategoryKeys = [
  { key: "economy", href: "/category/iqtisodiyot" },
  { key: "technology", href: "/category/texnologiya" },
  { key: "culture", href: "/category/madaniyat" }
] as const;

const moreLinkKeys = [
  { key: "search", href: "/search" },
  { key: "popular", href: "/popular" },
  { key: "editor", href: "/editor-choice" },
  { key: "about", href: "/about" },
  { key: "ads", href: "/ads" },
  { key: "contact", href: "/contact" }
] as const;

const languages: Array<{ code: Language; label: string; name: string }> = [
  { code: "uz", label: "UZ", name: "O'zbekcha" },
  { code: "ru", label: "RU", name: "Русский" },
  { code: "en", label: "EN", name: "English" }
];

export function Header() {
  const pathname = usePathname();
  const { language, setLanguage, theme, toggleTheme, t } = useUi();
  const { openSearch } = useSearch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [region, setRegion] = useState<UzRegion>(UZ_REGIONS[0]);
  const [weather, setWeather] = useState<FullWeather | null>(null);
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRefMobile = useRef<HTMLDivElement | null>(null);

  const activeHref = useMemo(() => {
    if (pathname === "/") return "/";
    const category = [...navKeys, ...moreCategoryKeys].find((item) => item.href !== "/" && pathname.startsWith(item.href));
    if (category) return category.href;
    return moreLinkKeys.find((item) => pathname.startsWith(item.href))?.href ?? "";
  }, [pathname]);

  const navLinkClass = (href: string) =>
    `nav-link flex h-full items-center whitespace-nowrap border-b-2 transition-all duration-200 ${
      activeHref === href ? "border-brand text-brand" : "border-transparent text-ink hover:border-brand/40 hover:text-brand"
    }`;

  useEffect(() => {
    const date = new Date();
    const months = {
      uz: ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"],
      ru: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
      en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    };
    const weekdays = {
      uz: ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"],
      ru: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
      en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    };
    setCurrentDate(`${weekdays[language][date.getDay()]}, ${date.getDate()} ${months[language][date.getMonth()]} ${date.getFullYear()}`);
  }, [language]);

  useEffect(() => {
    const savedRegion = localStorage.getItem("weather_region");
    if (savedRegion) {
      setRegion(findRegionByName(savedRegion));
      return;
    }
    // No saved preference yet: try to detect the user's own viloyat via geolocation, falling
    // back to Tashkent (the default state) if permission is denied or unavailable.
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // The permission prompt/lookup can resolve well after mount -- if the user has since
        // picked a region manually (selectRegion writes this key immediately), don't clobber it.
        if (localStorage.getItem("weather_region")) return;
        setRegion(nearestRegion(position.coords.latitude, position.coords.longitude));
      },
      () => {},
      { timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchFullWeather(region.lat, region.lon).then((data) => {
      if (!cancelled) setWeather(data);
    });
    return () => {
      cancelled = true;
    };
  }, [region]);

  // Rotating ticker: cycles between temperature, feels-like and the date every few seconds
  // instead of showing just one static line in the same amount of space.
  useEffect(() => {
    const timer = setInterval(() => setTickerIndex((value) => (value + 1) % 3), 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function closeFloatingMenus(event: PointerEvent) {
      const target = event.target as Node;
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) setMenuOpen(false);
      if (
        (!languageMenuRef.current || !languageMenuRef.current.contains(target)) &&
        (!languageMenuRefMobile.current || !languageMenuRefMobile.current.contains(target))
      ) {
        setLanguageOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeFloatingMenus);
    return () => document.removeEventListener("pointerdown", closeFloatingMenus);
  }, []);

  // Shrink the sticky header on scroll (72px -> 60px, stronger blur).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function selectRegion(next: UzRegion) {
    setRegion(next);
    localStorage.setItem("weather_region", next.name);
  }

  const tickerSlides = weather
    ? [`${region.name} ${weather.temperature}°C`, `His: ${weather.feelsLike}°C`, conditionLabel(weather.condition)]
    : [region.name, "...", currentDate];

  const selectedLanguage = languages.find((item) => item.code === language) ?? languages[0];

  return (
    <>
      <header className={`site-header border-b border-slate-200 bg-white ${scrolled ? "is-scrolled" : ""}`}>
        {/* ---- Desktop header (unchanged) ---- */}
        <div className="container-page hidden h-20 min-w-0 items-center gap-7 lg:flex">
          <Link href="/" className="flex shrink-0 items-center" aria-label={`${SITE_NAME} - ${SITE_ALTERNATE_NAME}`}>
            <Image
              src="/brand/logo-jx.png"
              alt={`${SITE_NAME} - ${SITE_ALTERNATE_NAME}`}
              width={398}
              height={234}
              priority
              className="h-14 w-auto object-contain"
            />
          </Link>
          <nav className="hidden h-full flex-1 items-center gap-8 pl-5 text-[15px] font-bold lg:flex">
            {navKeys.map((item) => (
              <Link key={item.href} className={navLinkClass(item.href)} href={item.href}>
                {t.nav[item.key]}
              </Link>
            ))}
            <div ref={moreMenuRef} className="relative h-full">
              <button onClick={() => setMenuOpen((value) => !value)} className={`nav-link flex h-full items-center gap-2 whitespace-nowrap border-b-2 font-bold transition ${[...moreLinkKeys, ...moreCategoryKeys].some((item) => item.href === activeHref) ? "border-brand text-brand" : "border-transparent hover:text-brand"}`}>
                {t.nav.more} <Menu size={18} />
              </button>
              {menuOpen && (
                <div className="menu-popover absolute right-0 top-[72px] z-40 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                  {moreCategoryKeys.map((item) => (
                    <Link key={item.href} onClick={() => setMenuOpen(false)} className={`block rounded-xl px-4 py-3 text-sm transition hover:bg-slate-50 hover:text-brand ${activeHref === item.href ? "text-brand" : "text-ink"}`} href={item.href}>
                      {t.nav[item.key]}
                    </Link>
                  ))}
                  <div className="my-1 border-t border-slate-200" />
                  {moreLinkKeys.map((item) => (
                    <Link key={item.href} onClick={() => setMenuOpen(false)} className={`block rounded-xl px-4 py-3 text-sm transition hover:bg-slate-50 hover:text-brand ${activeHref === item.href ? "text-brand" : "text-ink"}`} href={item.href}>
                      {t.more[item.key]}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2">
            <button onClick={() => setWeatherModalOpen(true)} className="weather-pill hidden md:flex">
              <CloudSun className="h-5 w-5 shrink-0 text-amber-300" />
              <span key={tickerIndex} className="weather-ticker">
                {tickerSlides[tickerIndex]}
              </span>
              <ChevronDown size={13} />
            </button>
            <button onClick={() => setWeatherModalOpen(true)} aria-label="Ob-havo" className="weather-mobile-button md:hidden">
              <CloudSun className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="wm-city">{region.name}</span>
              <span className="wm-temp">{weather ? `${weather.temperature}°` : "--°"}</span>
              <span className="wm-cond">{weather ? conditionLabel(weather.condition) : "..."}</span>
            </button>
            <div ref={languageMenuRef} className="language-wrap relative">
              <button onClick={() => setLanguageOpen((value) => !value)} className="language-trigger text-ink">
                <Globe2 size={15} />
                {selectedLanguage.label}
                <ChevronDown size={14} />
              </button>
              {languageOpen && (
                <div className="menu-popover absolute right-0 top-12 z-[100] w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xl">
                  {languages.map((item) => (
                    <button
                      key={item.code}
                      onClick={() => {
                        setLanguage(item.code);
                        setLanguageOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold transition hover:bg-slate-50 ${language === item.code ? "text-brand" : "text-ink"}`}
                    >
                      <span>{item.name}</span>
                      <span className="font-black">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Search lives in the mobile bottom bar; keep the icon on desktop only. */}
            <button onClick={openSearch} aria-label={t.more.search} className="icon-button header-search">
              <Search className="h-5 w-5 lg:h-6 lg:w-6" strokeWidth={2.2} />
            </button>
            <button onClick={toggleTheme} aria-label="Theme" className={`theme-toggle mobile-icon-toggle ${theme === "dark" ? "is-dark" : ""}`}>
              <span className="theme-knob">{theme === "dark" ? <Moon className="h-4 w-4" fill="white" /> : <Sun className="h-4 w-4" />}</span>
            </button>
          </div>
        </div>

        {/* ---- Mobile header (redesigned, premium) ---- */}
        <div className="mobile-header lg:hidden">
          <div className="mh-left">
            <Link href="/" aria-label={`${SITE_NAME} - ${SITE_ALTERNATE_NAME}`} className="mh-logo">
              <Image src={SITE_LOGO} alt={`${SITE_NAME} - ${SITE_ALTERNATE_NAME}`} width={166} height={64} priority className="h-7 w-auto max-w-[92px] object-contain" />
              <span className="mh-brand-text">
                <span>{SITE_NAME}</span>
                <small>{SITE_TAGLINE}</small>
              </span>
            </Link>
          </div>

          <div className="mh-center">
            <button onClick={() => setWeatherModalOpen(true)} aria-label="Ob-havo" className="mh-weather">
              <Sun className="mh-sun" size={16} />
              <span className="mh-city">{region.name}</span>
              <span key={weather ? weather.temperature : "x"} className="mh-temp">{weather ? `${weather.temperature}°` : "--°"}</span>
            </button>
          </div>

          <div className="mh-right">
            <button onClick={toggleTheme} aria-label="Kun/tun rejimi" className={`mh-theme ${theme === "dark" ? "is-dark" : ""}`}>
              <span className="mh-theme-knob">{theme === "dark" ? <Moon size={16} fill="currentColor" /> : <Sun size={16} />}</span>
            </button>

            <div ref={languageMenuRefMobile} className="relative">
              <button onClick={() => setLanguageOpen((value) => !value)} className="mh-lang" aria-label="Til">
                <Globe2 size={12} />
                <span>{selectedLanguage.label}</span>
                <ChevronDown size={12} className={`mh-chev ${languageOpen ? "is-open" : ""}`} />
              </button>
              {languageOpen && (
                <div className="menu-popover mh-pop absolute right-0 top-[46px] z-[110] w-40 overflow-hidden rounded-2xl p-1">
                  {languages.map((item) => (
                    <button
                      key={item.code}
                      onClick={() => {
                        setLanguage(item.code);
                        setLanguageOpen(false);
                      }}
                      className={`mh-pop-item flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold ${language === item.code ? "is-active" : ""}`}
                    >
                      <span>{item.name}</span>
                      <span className="font-black opacity-70">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <WeatherModal
        open={weatherModalOpen}
        onClose={() => setWeatherModalOpen(false)}
        region={region}
        regions={UZ_REGIONS}
        onSelectRegion={selectRegion}
      />
    </>
  );
}
