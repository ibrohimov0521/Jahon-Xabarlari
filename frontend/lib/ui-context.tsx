"use client";

import { useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type Language = "uz" | "ru" | "en";
export type Theme = "light" | "dark";

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
      sent: "Obuna qabul qilindi."
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
      sent: "Подписка принята."
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
      sent: "Subscription received."
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

export function UiProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Language>("uz");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const storedLanguage = localStorage.getItem("language") as Language | null;
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    if (storedLanguage && dictionaries[storedLanguage]) {
      setLanguageState(storedLanguage);
      // Backfill the cookie for users who picked a language before cookie-based SSR
      // translation existed, so the very next server render already matches.
      if (!document.cookie.includes(`lang=${storedLanguage}`)) {
        document.cookie = `lang=${storedLanguage}; path=/; max-age=31536000`;
      }
    }
    if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const value = useMemo<UiContextValue>(() => ({
    language,
    setLanguage(nextLanguage) {
      setLanguageState(nextLanguage);
      localStorage.setItem("language", nextLanguage);
      document.cookie = `lang=${nextLanguage}; path=/; max-age=31536000`;
      document.documentElement.lang = nextLanguage;
      // Server components (article/category/home pages) read the `lang` cookie to fetch
      // the right translation, so refresh their data after switching.
      router.refresh();
    },
    theme,
    toggleTheme() {
      setTheme((current) => (current === "dark" ? "light" : "dark"));
    },
    t: dictionaries[language]
  }), [language, theme]);

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const value = useContext(UiContext);
  if (!value) throw new Error("useUi must be used inside UiProvider");
  return value;
}
