"use client";

import { ChevronDown, CloudSun, Globe2, Menu, Moon, Search, Sun, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SearchModal } from "./SearchModal";
import { WeatherModal } from "./WeatherModal";
import { Language, useUi } from "../lib/ui-context";
import { SITE_LOGO, SITE_NAME } from "../lib/site";
import { conditionLabel, fetchFullWeather, findRegionByName, nearestRegion, UZ_REGIONS, type FullWeather, type UzRegion } from "../lib/weather";

const navKeys = [
  { key: "home", href: "/" },
  { key: "uzbekistan", href: "/category/ozbekiston" },
  { key: "world", href: "/category/dunyo" },
  { key: "politics", href: "/category/siyosat" },
  { key: "economy", href: "/category/iqtisodiyot" },
  { key: "technology", href: "/category/texnologiya" },
  { key: "sport", href: "/category/sport" },
  { key: "culture", href: "/category/madaniyat" }
] as const;

const moreLinkKeys = [
  { key: "popular", href: "/popular" },
  { key: "editor", href: "/editor-choice" },
  { key: "search", href: "/search" },
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [region, setRegion] = useState<UzRegion>(UZ_REGIONS[0]);
  const [weather, setWeather] = useState<FullWeather | null>(null);
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);

  const activeHref = useMemo(() => {
    if (pathname === "/") return "/";
    const category = navKeys.find((item) => item.href !== "/" && pathname.startsWith(item.href));
    if (category) return category.href;
    return moreLinkKeys.find((item) => pathname.startsWith(item.href))?.href ?? "";
  }, [pathname]);

  const navLinkClass = (href: string) =>
    `nav-link flex h-full items-center border-b-2 transition-all duration-200 ${
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
      (position) => setRegion(nearestRegion(position.coords.latitude, position.coords.longitude)),
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

  function selectRegion(next: UzRegion) {
    setRegion(next);
    localStorage.setItem("weather_region", next.name);
  }

  const tickerSlides = weather
    ? [`${region.name} ${weather.temperature}°C`, `His qilinishi: ${weather.feelsLike}°C`, conditionLabel(weather.condition)]
    : [region.name, "...", currentDate];

  const selectedLanguage = languages.find((item) => item.code === language) ?? languages[0];

  return (
    <>
      <header className="site-header border-b border-slate-200 bg-white">
        <div className="container-page flex h-16 min-w-0 items-center gap-2 lg:h-20 lg:gap-7">
          <Link href="/" className="flex shrink-0 items-center" aria-label={SITE_NAME}>
            <Image
              src={SITE_LOGO}
              alt={SITE_NAME}
              width={166}
              height={64}
              priority
              className="h-10 w-auto max-w-[92px] rounded-md object-contain sm:h-12 sm:max-w-none lg:h-14"
            />
          </Link>
          <nav className="hidden h-full flex-1 items-center gap-8 pl-5 text-[15px] font-bold lg:flex">
            {navKeys.map((item) => (
              <Link key={item.href} className={navLinkClass(item.href)} href={item.href}>
                {t.nav[item.key]}
              </Link>
            ))}
            <div className="relative h-full">
              <button onClick={() => setMenuOpen((value) => !value)} className={`nav-link flex h-full items-center gap-2 border-b-2 font-bold transition ${moreLinkKeys.some((item) => item.href === activeHref) ? "border-brand text-brand" : "border-transparent hover:text-brand"}`}>
                {t.nav.more} <Menu size={18} />
              </button>
              {menuOpen && (
                <div className="menu-popover absolute right-0 top-[72px] z-40 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
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
              <span key={tickerIndex} className="weather-ticker min-w-[92px] text-left">
                {tickerSlides[tickerIndex]}
              </span>
              <ChevronDown size={13} />
            </button>
            <div className="relative">
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
            <button onClick={() => setSearchOpen(true)} aria-label={t.more.search} className="icon-button">
              <Search className="h-5 w-5 lg:h-6 lg:w-6" strokeWidth={2.2} />
            </button>
            <button onClick={toggleTheme} aria-label="Theme" className={`theme-toggle mobile-icon-toggle ${theme === "dark" ? "is-dark" : ""}`}>
              <span className="theme-knob">{theme === "dark" ? <Moon className="h-4 w-4" fill="white" /> : <Sun className="h-4 w-4" />}</span>
            </button>
            <button onClick={() => setMobileOpen((value) => !value)} aria-label="Menu" className="icon-button lg:hidden">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="container-page grid gap-1 border-t border-slate-100 py-3 lg:hidden">
            {[...navKeys.map((item) => ({ href: item.href, label: t.nav[item.key] })), ...moreLinkKeys.map((item) => ({ href: item.href, label: t.more[item.key] }))].map((item) => (
              <Link key={item.href} onClick={() => setMobileOpen(false)} className={`rounded-md px-3 py-3 font-bold transition hover:bg-slate-50 ${activeHref === item.href ? "bg-blue-50 text-brand" : "text-ink"}`} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
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
