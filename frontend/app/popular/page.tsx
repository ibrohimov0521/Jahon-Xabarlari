import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { NewsCard } from "../../components/NewsCard";
import { getArticles } from "../../lib/api";
import { getRequestLang } from "../../lib/server-lang";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Eng ko'p o'qilgan yangiliklar",
  description: `O'quvchilar eng ko'p ko'rgan dolzarb yangiliklar - ${SITE_NAME}.`,
  alternates: { canonical: `${SITE_URL}/popular` }
};

export default async function PopularPage() {
  const lang = await getRequestLang();
  const all = await getArticles("?limit=36", lang);
  // showInPopular is opt-in (defaults false), so an un-curated site would show nothing if it
  // were a hard filter -- prefer the curated subset once it has enough items, otherwise fall
  // back to ranking everything by views like before.
  const curated = all.filter((item) => item.showInPopular);
  const articles = (curated.length >= 6 ? curated : all).sort((a, b) => b.viewsCount - a.viewsCount).slice(0, 12);
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="section-title text-3xl font-black">Eng ko'p o'qilganlar</h1>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} />)}
        </div>
      </section>
    </main>
  );
}
