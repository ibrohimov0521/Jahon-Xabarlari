import { Header } from "../../components/Header";
import { NewsCard } from "../../components/NewsCard";
import { getArticles } from "../../lib/api";

export default async function SearchPage() {
  const articles = await getArticles("?limit=9");
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="text-3xl font-black">Qidiruv</h1>
        <input className="mt-5 h-12 w-full rounded-md border border-slate-200 px-4" placeholder="Yangilik qidirish" />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} />)}
        </div>
      </section>
    </main>
  );
}
