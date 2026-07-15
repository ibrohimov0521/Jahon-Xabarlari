import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { NewsCard } from "../../components/NewsCard";
import { getPopularArticles } from "../../lib/api";
import { getRequestLang } from "../../lib/server-lang";
import { SITE_NAME, SITE_URL } from "../../lib/site";

const copy = {
  uz: { title: "Eng ko'p o'qilgan yangiliklar", heading: "Eng ko'p o'qilganlar", description: `O'quvchilar eng ko'p ko'rgan dolzarb yangiliklar - ${SITE_NAME}.` },
  ru: { title: "Самые читаемые новости", heading: "Самые читаемые", description: `Самые популярные и актуальные новости среди читателей ${SITE_NAME}.` },
  en: { title: "Most read news", heading: "Most read", description: `The most popular and widely read stories on ${SITE_NAME}.` }
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getRequestLang();
  const baseUrl = `${SITE_URL}/popular`;
  return {
    title: copy[lang].title,
    description: copy[lang].description,
    alternates: {
      canonical: lang === "uz" ? baseUrl : `${baseUrl}?lang=${lang}`,
      languages: { uz: baseUrl, ru: `${baseUrl}?lang=ru`, en: `${baseUrl}?lang=en`, "x-default": baseUrl }
    }
  };
}

export default async function PopularPage() {
  const lang = await getRequestLang();
  const articles = await getPopularArticles(lang, 12, 4);
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="section-title text-3xl font-black">{copy[lang].heading}</h1>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} language={lang} />)}
        </div>
      </section>
    </main>
  );
}
