"use client";

import { ChevronDown, Menu, Moon, Search, Send, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

const nav = [
  { label: "Bosh sahifa", href: "/" },
  { label: "O'zbekiston", href: "/category/ozbekiston" },
  { label: "Dunyo", href: "/category/dunyo" },
  { label: "Siyosat", href: "/category/siyosat" },
  { label: "Iqtisodiyot", href: "/category/iqtisodiyot" },
  { label: "Texnologiya", href: "/category/texnologiya" },
  { label: "Sport", href: "/category/sport" },
  { label: "Madaniyat", href: "/category/madaniyat" }
];

const moreLinks = [
  { label: "Eng ko'p o'qilganlar", href: "/popular" },
  { label: "Muharrir tanlovi", href: "/editor-choice" },
  { label: "Qidiruv", href: "/search" },
  { label: "Biz haqimizda", href: "/about" },
  { label: "Reklama", href: "/ads" },
  { label: "Aloqa", href: "/contact" }
];

const languages = ["UZ", "RU", "EN"];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [language, setLanguage] = useState("UZ");
  const [dark, setDark] = useState(false);

  const activeHref = useMemo(() => {
    if (pathname === "/") return "/";
    const category = nav.find((item) => item.href !== "/" && pathname.startsWith(item.href));
    if (category) return category.href;
    return moreLinks.find((item) => pathname.startsWith(item.href))?.href ?? "";
  }, [pathname]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const q = String(formData.get("q") ?? "").trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    setSearchOpen(false);
  }

  function toggleTheme() {
    setDark((value) => !value);
    document.documentElement.classList.toggle("dark-preview");
  }

  const navLinkClass = (href: string) =>
    `flex h-full items-center border-b-2 transition-colors duration-200 ${
      activeHref === href ? "border-brand text-brand" : "border-transparent text-ink hover:border-brand/40 hover:text-brand"
    }`;

  return (
    <>
      <div className="bg-ink text-white">
        <div className="container-page flex h-10 items-center justify-between text-sm">
          <div className="hidden items-center gap-8 sm:flex">
            <span>Toshkent&nbsp;&nbsp; 22C</span>
            <span>12 May, 2025&nbsp; Dushanba</span>
          </div>
          <div className="ml-auto flex items-center gap-7">
            <Link className="transition hover:text-blue-200" href="/about">Biz haqimizda</Link>
            <Link className="transition hover:text-blue-200" href="/ads">Reklama</Link>
            <Link className="transition hover:text-blue-200" href="/contact">Aloqa</Link>
            <div className="hidden items-center gap-4 lg:flex">
              <a aria-label="Telegram" className="grid size-5 place-items-center rounded-full bg-sky-500" href="https://t.me/" target="_blank"><Send size={12} fill="white" /></a>
              <a aria-label="Facebook" className="grid size-5 place-items-center rounded-full bg-blue-600 text-xs font-black" href="https://facebook.com/" target="_blank">f</a>
              <a aria-label="Instagram" className="grid size-5 place-items-center rounded-full bg-rose-500 text-[10px] font-black" href="https://instagram.com/" target="_blank">◎</a>
              <a aria-label="YouTube" className="grid size-5 place-items-center rounded-full bg-red-700 text-[10px] font-black" href="https://youtube.com/" target="_blank">▶</a>
            </div>
            <div className="relative">
              <button onClick={() => setLanguageOpen((value) => !value)} className="flex items-center gap-1 font-bold">
                {language} <ChevronDown size={14} />
              </button>
              {languageOpen && (
                <div className="absolute right-0 top-7 z-40 w-24 overflow-hidden rounded-md border border-white/10 bg-ink shadow-xl">
                  {languages.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setLanguage(item);
                        setLanguageOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-white/10 ${language === item ? "text-blue-300" : ""}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <header className="border-b border-slate-200 bg-white">
        <div className="container-page flex h-20 items-center gap-7">
          <Link href="/" className="mr-8 text-[31px] font-black tracking-normal text-ink">
            Jahon <span className="text-brand">Xabarlari</span>
          </Link>
          <nav className="hidden h-full flex-1 items-center gap-8 text-[15px] font-bold lg:flex">
            {nav.map((item) => (
              <Link key={item.href} className={navLinkClass(item.href)} href={item.href}>
                {item.label}
              </Link>
            ))}
            <div className="relative h-full">
              <button onClick={() => setMenuOpen((value) => !value)} className={`flex h-full items-center gap-2 border-b-2 font-bold transition ${moreLinks.some((item) => item.href === activeHref) ? "border-brand text-brand" : "border-transparent hover:text-brand"}`}>
                Ko'proq <Menu size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-[72px] z-40 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 shadow-xl">
                  {moreLinks.map((item) => (
                    <Link key={item.href} onClick={() => setMenuOpen(false)} className={`block px-4 py-3 text-sm transition hover:bg-slate-50 hover:text-brand ${activeHref === item.href ? "text-brand" : "text-ink"}`} href={item.href}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <button onClick={() => setSearchOpen(true)} aria-label="Qidiruv" className="grid size-11 place-items-center rounded-full transition hover:bg-slate-100 hover:text-brand">
            <Search size={25} strokeWidth={2.2} />
          </button>
          <button onClick={toggleTheme} aria-label="Dark mode" className={`grid size-11 place-items-center rounded-full shadow-lg transition ${dark ? "bg-brand text-white" : "bg-ink text-white"}`}>
            <Moon size={21} fill="white" />
          </button>
          <button onClick={() => setMobileOpen((value) => !value)} aria-label="Menu" className="grid size-10 place-items-center rounded-full transition hover:bg-slate-100 lg:hidden">
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileOpen && (
          <nav className="container-page grid gap-1 border-t border-slate-100 py-3 lg:hidden">
            {[...nav, ...moreLinks].map((item) => (
              <Link key={item.href} onClick={() => setMobileOpen(false)} className={`rounded-md px-3 py-3 font-bold transition hover:bg-slate-50 ${activeHref === item.href ? "bg-blue-50 text-brand" : "text-ink"}`} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-ink/50 p-4 backdrop-blur-sm">
          <form onSubmit={submitSearch} className="mx-auto mt-24 flex max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <input autoFocus name="q" className="h-14 min-w-0 flex-1 px-5 outline-none" placeholder="Yangilik qidirish..." />
            <button className="bg-brand px-6 font-black text-white" type="submit">Qidirish</button>
            <button aria-label="Yopish" onClick={() => setSearchOpen(false)} className="grid w-14 place-items-center text-slate-500 transition hover:text-ink" type="button">
              <X />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
