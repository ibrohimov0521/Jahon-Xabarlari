import type { Metadata } from "next";
import { Filter, Search } from "lucide-react";
import { Header } from "../../components/Header";
import { NewsCard } from "../../components/NewsCard";
import { getArticles, searchArticles } from "../../lib/api";
import { getRequestLang } from "../../lib/server-lang";
import { SITE_NAME, SITE_URL } from "../../lib/site";

const categories = [
  ["", "Barcha bo'limlar"],
  ["ozbekiston", "O'zbekiston"],
  ["dunyo", "Dunyo"],
  ["siyosat", "Siyosat"],
  ["iqtisodiyot", "Iqtisodiyot"],
  ["texnologiya", "Texnologiya"],
  ["sport", "Sport"],
  ["madaniyat", "Madaniyat"]
];

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
        <form className="news-shadow mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 lg:grid-cols-[minmax(220px,1fr)_200px_190px_auto]" action="/search">
          <label className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
            <Search size={20} className="shrink-0 text-brand" />
            <input name="q" defaultValue={q} className="h-12 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-slate-400" placeholder="Yangilik qidirish" />
          </label>
          <select name="category" defaultValue={category} className="h-12 rounded-xl border border-slate-200 bg-white px-3 font-bold text-ink outline-none">
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="sort" defaultValue={sort} className="h-12 rounded-xl border border-slate-200 bg-white px-3 font-bold text-ink outline-none">
            <option value="latest">Eng yangilari</option>
            <option value="popular">Ko'p o'qilganlar</option>
          </select>
          <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 font-black text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-500">
            <Filter size={18} /> Saralash
          </button>
        </form>
        {(q || category || sort !== "latest") && <p className="mt-4 text-slate-500">Natijalar: {q ? `"${q}"` : "barcha yangiliklar"}</p>}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} />)}
        </div>
      </section>
    </main>
  );
}
