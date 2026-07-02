import { Header } from "../../../components/Header";
import { getArticle } from "../../../lib/api";

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  return (
    <main>
      <Header />
      <article className="container-page max-w-4xl py-8">
        <span className="font-black uppercase text-brand">{article.category?.name}</span>
        <h1 className="mt-3 text-4xl font-black leading-tight">{article.title}</h1>
        <p className="mt-4 text-lg text-slate-600">{article.summary}</p>
        <img src={article.mainImage} alt="" className="mt-7 aspect-video w-full rounded-lg object-cover" />
        <div className="prose prose-lg mt-8 max-w-none">
          <p>{article.content}</p>
        </div>
      </article>
    </main>
  );
}
