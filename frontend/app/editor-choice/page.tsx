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
  const articles = await getArticles("?limit=9", lang);
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="text-3xl font-black">Muharrir tanlovi</h1>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} />)}
        </div>
      </section>
    </main>
  );
}
