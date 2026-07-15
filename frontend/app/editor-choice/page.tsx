import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { NewsCard } from "../../components/NewsCard";
import { getArticles } from "../../lib/api";
import { getRequestLang } from "../../lib/server-lang";
import { SITE_NAME, SITE_URL } from "../../lib/site";

const copy = {
  uz: { title: "Muharrir tanlovi", empty: "Hozircha muharrir tomonidan tanlangan maqolalar yo'q.", description: `${SITE_NAME} tahririyati tanlagan eng muhim va dolzarb xabarlar.` },
  ru: { title: "Выбор редакции", empty: "Редакция пока не выбрала ни одной статьи.", description: `Самые важные и актуальные материалы по выбору редакции ${SITE_NAME}.` },
  en: { title: "Editor's choice", empty: "No articles have been selected by the editors yet.", description: `The most important and timely stories selected by the ${SITE_NAME} editorial team.` }
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getRequestLang();
  const baseUrl = `${SITE_URL}/editor-choice`;
  return {
    title: copy[lang].title,
    description: copy[lang].description,
    alternates: {
      canonical: lang === "uz" ? baseUrl : `${baseUrl}?lang=${lang}`,
      languages: { uz: baseUrl, ru: `${baseUrl}?lang=ru`, en: `${baseUrl}?lang=en`, "x-default": baseUrl }
    }
  };
}

export default async function EditorChoicePage() {
  const lang = await getRequestLang();
  const articles = (await getArticles("?limit=36", lang)).filter((item) => item.isEditorChoice);
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="section-title text-3xl font-black">{copy[lang].title}</h1>
        {articles.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((item) => <NewsCard key={item.id} article={item} language={lang} />)}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-10 text-center news-shadow">
            <p className="text-slate-500">{copy[lang].empty}</p>
          </div>
        )}
      </section>
    </main>
  );
}
