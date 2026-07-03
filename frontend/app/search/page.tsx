import { Header } from "../../components/Header";
import { NewsCard } from "../../components/NewsCard";
import { getArticles, searchArticles } from "../../lib/api";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const articles = q ? await searchArticles(q) : await getArticles("?limit=9");
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="text-3xl font-black">Qidiruv</h1>
        <form className="mt-5 flex overflow-hidden rounded-md border border-slate-200 bg-white" action="/search">
          <input name="q" defaultValue={q} className="h-12 min-w-0 flex-1 px-4 outline-none" placeholder="Yangilik qidirish" />
          <button className="bg-brand px-6 font-black text-white transition hover:bg-blue-500">Qidirish</button>
        </form>
        {q && <p className="mt-4 text-slate-500">Natijalar: "{q}"</p>}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} />)}
        </div>
      </section>
    </main>
  );
}
