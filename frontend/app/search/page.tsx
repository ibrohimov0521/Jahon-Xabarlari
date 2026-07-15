import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { NewsCard } from "../../components/NewsCard";
import { SearchFilterForm } from "../../components/SearchFilterForm";
import { getArticles, searchArticles } from "../../lib/api";
import { getRequestLang } from "../../lib/server-lang";
import { SITE_NAME, SITE_URL } from "../../lib/site";

const copy = {
  uz: { title: "Yangiliklarni saralash", heading: "Saralash", results: "Natijalar", all: "barcha yangiliklar", description: `${SITE_NAME} saytidan yangiliklarni qidirish, bo'lim va saralash bo'yicha toping.` },
  ru: { title: "Поиск и фильтр новостей", heading: "Поиск и фильтр", results: "Результаты", all: "все новости", description: `Найдите новости ${SITE_NAME} по запросу, разделу и популярности.` },
  en: { title: "Search and filter news", heading: "Search and filter", results: "Results", all: "all news", description: `Find ${SITE_NAME} stories by keyword, category and popularity.` }
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getRequestLang();
  const baseUrl = `${SITE_URL}/search`;
  return {
    title: copy[lang].title,
    description: copy[lang].description,
    alternates: { canonical: lang === "uz" ? baseUrl : `${baseUrl}?lang=${lang}` },
    robots: { index: false, follow: true }
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; sort?: string }> }) {
  const { q = "", category = "", sort = "latest" } = await searchParams;
  const lang = await getRequestLang();
  const query = `${category ? `&category=${encodeURIComponent(category)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}`;
  const articles = q || category || sort !== "latest" ? await searchArticles(q, lang, query) : await getArticles("?limit=9", lang);
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="section-title text-3xl font-black">{copy[lang].heading}</h1>
        <SearchFilterForm q={q} category={category} sort={sort} />
        {(q || category || sort !== "latest") && <p className="mt-4 text-slate-500">{copy[lang].results}: {q ? `"${q}"` : copy[lang].all}</p>}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} language={lang} />)}
        </div>
      </section>
    </main>
  );
}
