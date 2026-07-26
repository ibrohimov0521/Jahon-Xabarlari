"use client";

import { useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { readStorage, writeStorage } from "./browser-storage";

export type Language = "uz" | "ru" | "en";
export type Theme = "light" | "dark";

function isLanguage(value: string | null): value is Language {
  return value === "uz" || value === "ru" || value === "en";
}

function writeLanguageCookie(language: Language) {
  document.cookie = `lang=${language}; path=/; max-age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

function browserLanguage(): Language {
  const preferences = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const preference of preferences) {
    const code = preference.toLowerCase().split("-")[0];
    if (code === "ru" || code === "en") return code;
    if (code === "uz") return "uz";
  }
  return "uz";
}

const dictionaries = {
  uz: {
    nav: {
      home: "Bosh sahifa",
      uzbekistan: "O'zbekiston",
      world: "Dunyo",
      politics: "Siyosat",
      economy: "Iqtisodiyot",
      technology: "Texnologiya",
      sport: "Sport",
      culture: "Madaniyat",
      more: "Ko'proq"
    },
    top: {
      about: "Biz haqimizda",
      ads: "Reklama",
      contact: "Aloqa",
      city: "Toshkent",
      day: "Dushanba"
    },
    more: {
      popular: "Eng ko'p o'qilganlar",
      editor: "Muharrir tanlovi",
      search: "Saralash",
      about: "Biz haqimizda",
      ads: "Reklama",
      contact: "Aloqa"
    },
    search: {
      placeholder: "Yangilik qidirish...",
      button: "Qidirish",
      close: "Yopish"
    },
    subscribe: {
      title: "Yangiliklarni o'tkazib yubormang!",
      body: "Eng muhim xabarlar emailingizga yuboriladi.",
      placeholder: "Email manzilingiz",
      button: "Obuna bo'lish",
      sent: "Obuna qabul qilindi.",
      error: "Xatolik yuz berdi, qayta urinib ko'ring."
    },
    footer: {
      navigation: "Sayt havolalari",
      about: "Sayt haqida",
      ads: "Reklama",
      contact: "Aloqa",
      editorial: "Tahririyat siyosati",
      corrections: "Tuzatishlar",
      privacy: "Maxfiylik"
    }
  },
  ru: {
    nav: {
      home: "Главная",
      uzbekistan: "Узбекистан",
      world: "Мир",
      politics: "Политика",
      economy: "Экономика",
      technology: "Технологии",
      sport: "Спорт",
      culture: "Культура",
      more: "Ещё"
    },
    top: {
      about: "О нас",
      ads: "Реклама",
      contact: "Контакты",
      city: "Ташкент",
      day: "Понедельник"
    },
    more: {
      popular: "Самое читаемое",
      editor: "Выбор редакции",
      search: "Поиск",
      about: "О нас",
      ads: "Реклама",
      contact: "Контакты"
    },
    search: {
      placeholder: "Поиск новостей...",
      button: "Искать",
      close: "Закрыть"
    },
    subscribe: {
      title: "Не пропустите новости!",
      body: "Главные новости будут приходить на вашу почту.",
      placeholder: "Ваш email",
      button: "Подписаться",
      sent: "Подписка принята.",
      error: "Произошла ошибка, попробуйте снова."
    },
    footer: {
      navigation: "Ссылки сайта",
      about: "О сайте",
      ads: "Реклама",
      contact: "Контакты",
      editorial: "Редакционная политика",
      corrections: "Исправления",
      privacy: "Конфиденциальность"
    }
  },
  en: {
    nav: {
      home: "Home",
      uzbekistan: "Uzbekistan",
      world: "World",
      politics: "Politics",
      economy: "Economy",
      technology: "Technology",
      sport: "Sport",
      culture: "Culture",
      more: "More"
    },
    top: {
      about: "About",
      ads: "Advertising",
      contact: "Contact",
      city: "Tashkent",
      day: "Monday"
    },
    more: {
      popular: "Most read",
      editor: "Editor's choice",
      search: "Filter",
      about: "About",
      ads: "Advertising",
      contact: "Contact"
    },
    search: {
      placeholder: "Search news...",
      button: "Search",
      close: "Close"
    },
    subscribe: {
      title: "Don't miss the news!",
      body: "The most important stories will be sent to your email.",
      placeholder: "Your email",
      button: "Subscribe",
      sent: "Subscription received.",
      error: "Something went wrong, please try again."
    },
    footer: {
      navigation: "Site links",
      about: "About",
      ads: "Advertising",
      contact: "Contact",
      editorial: "Editorial policy",
      corrections: "Corrections",
      privacy: "Privacy"
    }
  }
};

type UiContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  toggleTheme: () => void;
  t: typeof dictionaries.uz;
};

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children, initialLanguage = "uz" }: { children: ReactNode; initialLanguage?: Language }) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const storedTheme = readStorage("theme") as Theme | null;
    const urlLanguage = new URLSearchParams(window.location.search).get("lang");
    const cookieLanguage = document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("lang="))
      ?.slice(5) ?? null;
    const storedLanguage = readStorage("language");
    const resolvedLanguage = isLanguage(urlLanguage)
      ? urlLanguage
      : isLanguage(cookieLanguage)
        ? cookieLanguage
        : isLanguage(storedLanguage)
          ? storedLanguage
          : browserLanguage();
    setLanguageState(resolvedLanguage);
    writeStorage("language", resolvedLanguage);
    writeLanguageCookie(resolvedLanguage);
    document.documentElement.lang = resolvedLanguage;
    if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
    if (!isLanguage(urlLanguage) && !isLanguage(cookieLanguage) && resolvedLanguage !== "uz") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", resolvedLanguage);
      router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    }
  }, [initialLanguage, router]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    writeStorage("theme", theme);
  }, [theme]);

  const value = useMemo<UiContextValue>(() => ({
    language,
    setLanguage(nextLanguage) {
      setLanguageState(nextLanguage);
      writeStorage("language", nextLanguage);
      writeLanguageCookie(nextLanguage);
      document.documentElement.lang = nextLanguage;
      // Keep direct article/search URLs in sync too. Otherwise an existing ?lang= value
      // wins over the new cookie and a server-rendered article remains in the old language.
      const url = new URL(window.location.href);
      if (nextLanguage === "uz") url.searchParams.delete("lang");
      else url.searchParams.set("lang", nextLanguage);
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl === currentUrl) router.refresh();
      else router.replace(nextUrl, { scroll: false });
    },
    theme,
    toggleTheme() {
      setTheme((current) => (current === "dark" ? "light" : "dark"));
    },
    t: dictionaries[language]
  }), [language, router, theme]);

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const value = useContext(UiContext);
  if (!value) throw new Error("useUi must be used inside UiProvider");
  return value;
}
