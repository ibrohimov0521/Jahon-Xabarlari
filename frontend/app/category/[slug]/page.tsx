import type { Metadata } from "next";
import { Header } from "../../../components/Header";
import { NewsCard } from "../../../components/NewsCard";
import { getArticles } from "../../../lib/api";
import { getRequestLang } from "../../../lib/server-lang";
import { SITE_NAME, SITE_URL } from "../../../lib/site";

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
  return {
    title: `${name} yangiliklari`,
    description: `${name} bo'yicha eng so'nggi, ishonchli va muhim yangiliklar - ${SITE_NAME}.`,
    alternates: { canonical: `${SITE_URL}/category/${slug}` },
    openGraph: {
      title: `${name} yangiliklari | ${SITE_NAME}`,
      description: `${name} bo'yicha eng so'nggi yangiliklar.`,
      url: `${SITE_URL}/category/${slug}`,
      type: "website"
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
        <h1 className="text-3xl font-black capitalize">{categoryName(slug)}</h1>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => <NewsCard key={item.id} article={item} />)}
        </div>
      </section>
    </main>
  );
}
