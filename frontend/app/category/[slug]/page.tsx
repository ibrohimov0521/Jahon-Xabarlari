import { Header } from "../../../components/Header";
import { NewsCard } from "../../../components/NewsCard";
import { getArticles } from "../../../lib/api";
import { getRequestLang } from "../../../lib/server-lang";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await getRequestLang();
  const articles = await getArticles(`?category=${slug}`, lang);
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="text-3xl font-black capitalize">{slug.replaceAll("-", " ")}</h1>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} />)}
        </div>
      </section>
    </main>
  );
}
