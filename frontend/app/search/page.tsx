import type { Metadata } from "next";
import { Search } from "lucide-react";
import { Header } from "../../components/Header";
import { NewsCard } from "../../components/NewsCard";
import { getArticles, searchArticles } from "../../lib/api";
import { getRequestLang } from "../../lib/server-lang";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Yangilik qidirish",
  description: `${SITE_NAME} saytidan O'zbekiston, dunyo, siyosat, iqtisodiyot, texnologiya va sport yangiliklarini qidiring.`,
  alternates: { canonical: `${SITE_URL}/search` },
  robots: { index: false, follow: true }
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const lang = await getRequestLang();
  const articles = q ? await searchArticles(q, lang) : await getArticles("?limit=9", lang);
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="text-3xl font-black">Qidiruv</h1>
        <form className="news-shadow mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2" action="/search">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-brand"><Search size={20} /></span>
          <input name="q" defaultValue={q} className="h-12 min-w-0 flex-1 bg-transparent px-2 text-base font-semibold outline-none placeholder:text-slate-400" placeholder="Yangilik qidirish" />
          <button className="h-12 rounded-xl bg-brand px-6 font-black text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-500">Qidirish</button>
        </form>
        {q && <p className="mt-4 text-slate-500">Natijalar: "{q}"</p>}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} />)}
        </div>
      </section>
    </main>
  );
}
