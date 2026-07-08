import type { Metadata } from "next";
import { Header } from "../../../components/Header";
import { NewsCard } from "../../../components/NewsCard";
import { getArticles } from "../../../lib/api";
import { getRequestLang } from "../../../lib/server-lang";
import { SITE_NAME, SITE_OG_IMAGE, SITE_URL } from "../../../lib/site";

const CATEGORY_NAMES: Record<string, string> = {
  ozbekiston: "O'zbekiston",
  dunyo: "Dunyo",
  siyosat: "Siyosat",
  iqtisodiyot: "Iqtisodiyot",
  texnologiya: "Texnologiya",
  sport: "Sport",
  madaniyat: "Madaniyat"
};

function categoryName(slug: string) {
  return CATEGORY_NAMES[slug] ?? slug.replaceAll("-", " ");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = categoryName(slug);
  const title = `${name} yangiliklari`;
  const description = `${name} bo'yicha eng so'nggi, ishonchli va muhim yangiliklar — ${SITE_NAME}.`;
  const url = `${SITE_URL}/category/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      type: "website",
      siteName: SITE_NAME,
      locale: "uz_UZ",
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
        <h1 className="section-title text-3xl font-black capitalize">{categoryName(slug)}</h1>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} />)}
        </div>
      </section>
    </main>
  );
}
