import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { NewsCard } from "../../components/NewsCard";
import { getArticles } from "../../lib/api";
import { getRequestLang } from "../../lib/server-lang";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Muharrir tanlovi",
  description: `${SITE_NAME} tahririyati tanlagan eng muhim va dolzarb xabarlar.`,
  alternates: { canonical: `${SITE_URL}/editor-choice` }
};

export default async function EditorChoicePage() {
  const lang = await getRequestLang();
  const articles = (await getArticles("?limit=36", lang)).filter((item) => item.isEditorChoice);
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="section-title text-3xl font-black">Muharrir tanlovi</h1>
        {articles.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((item) => <NewsCard key={item.id} article={item} />)}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-10 text-center news-shadow">
            <p className="text-slate-500">Hozircha muharrir tomonidan tanlangan maqolalar yo'q.</p>
          </div>
        )}
      </section>
    </main>
  );
}
