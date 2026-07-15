import type { Metadata } from "next";
import { Header } from "../../../components/Header";
import { NewsCard } from "../../../components/NewsCard";
import { getArticles } from "../../../lib/api";
import { getRequestLang } from "../../../lib/server-lang";
import { SITE_NAME, SITE_OG_IMAGE, SITE_URL } from "../../../lib/site";

type Language = "uz" | "ru" | "en";

const CATEGORY_NAMES: Record<Language, Record<string, string>> = {
  uz: { ozbekiston: "O'zbekiston", dunyo: "Dunyo", siyosat: "Siyosat", iqtisodiyot: "Iqtisodiyot", texnologiya: "Texnologiya", sport: "Sport", madaniyat: "Madaniyat" },
  ru: { ozbekiston: "Узбекистан", dunyo: "Мир", siyosat: "Политика", iqtisodiyot: "Экономика", texnologiya: "Технологии", sport: "Спорт", madaniyat: "Культура" },
  en: { ozbekiston: "Uzbekistan", dunyo: "World", siyosat: "Politics", iqtisodiyot: "Business", texnologiya: "Technology", sport: "Sport", madaniyat: "Culture" }
};

const CATEGORY_SEO = {
  uz: { suffix: "yangiliklari", description: (name: string) => `${name} bo'yicha eng so'nggi, ishonchli va muhim yangiliklar — ${SITE_NAME}.` },
  ru: { suffix: "новости", description: (name: string) => `Последние достоверные и важные новости по теме «${name}» — ${SITE_NAME}.` },
  en: { suffix: "news", description: (name: string) => `The latest reliable and important ${name} news from ${SITE_NAME}.` }
};

function categoryName(slug: string, lang: Language) {
  return CATEGORY_NAMES[lang][slug] ?? slug.replaceAll("-", " ");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getRequestLang();
  const name = categoryName(slug, lang);
  const title = `${name} ${CATEGORY_SEO[lang].suffix}`;
  const description = CATEGORY_SEO[lang].description(name);
  const baseUrl = `${SITE_URL}/category/${slug}`;
  const url = lang === "uz" ? baseUrl : `${baseUrl}?lang=${lang}`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { uz: baseUrl, ru: `${baseUrl}?lang=ru`, en: `${baseUrl}?lang=en`, "x-default": baseUrl }
    },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      type: "website",
      siteName: SITE_NAME,
      locale: lang === "uz" ? "uz_UZ" : lang === "ru" ? "ru_RU" : "en_US",
      images: [{ url: SITE_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }]
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [SITE_OG_IMAGE]
    }
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await getRequestLang();
  const articles = await getArticles(`?category=${slug}`, lang);
  return (
    <main>
      <Header />
      <section className="container-page py-8">
        <h1 className="section-title text-3xl font-black capitalize">{categoryName(slug, lang)}</h1>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} language={lang} />)}
        </div>
      </section>
    </main>
  );
}
