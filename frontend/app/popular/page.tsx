import { Header } from "../../components/Header";
import { NewsCard } from "../../components/NewsCard";
import { getArticles } from "../../lib/api";
import { getRequestLang } from "../../lib/server-lang";

export default async function PopularPage() {
  const lang = await getRequestLang();
  const articles = (await getArticles("?limit=12", lang)).sort((a, b) => b.viewsCount - a.viewsCount);
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="text-3xl font-black">Eng ko'p o'qilganlar</h1>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} />)}
        </div>
      </section>
    </main>
  );
}
