import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { NewsCard } from "../../components/NewsCard";
import { SearchFilterForm } from "../../components/SearchFilterForm";
import { getArticles, searchArticles } from "../../lib/api";
import { getRequestLang } from "../../lib/server-lang";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Yangiliklarni saralash",
  description: `${SITE_NAME} saytidan yangiliklarni qidirish, bo'lim va saralash bo'yicha toping.`,
  alternates: { canonical: `${SITE_URL}/search` },
  robots: { index: false, follow: true }
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; sort?: string }> }) {
  const { q = "", category = "", sort = "latest" } = await searchParams;
  const lang = await getRequestLang();
  const query = `${category ? `&category=${encodeURIComponent(category)}` : ""}${sort ? `&sort=${encodeURIComponent(sort)}` : ""}`;
  const articles = q || category || sort !== "latest" ? await searchArticles(q, lang, query) : await getArticles("?limit=9", lang);
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="section-title text-3xl font-black">Saralash</h1>
        <SearchFilterForm q={q} category={category} sort={sort} />
        {(q || category || sort !== "latest") && <p className="mt-4 text-slate-500">Natijalar: {q ? `"${q}"` : "barcha yangiliklar"}</p>}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} />)}
        </div>
      </section>
    </main>
  );
}
