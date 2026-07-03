import type { Metadata } from "next";
import { Header } from "../../../components/Header";
import { getArticle } from "../../../lib/api";
import { getRequestLang } from "../../../lib/server-lang";
import { SITE_NAME, SITE_URL } from "../../../lib/site";

type ArticlePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getRequestLang();
  const article = await getArticle(slug, lang);
  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.summary;
  const url = `${SITE_URL}/articles/${article.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: SITE_NAME,
      images: article.mainImage ? [{ url: article.mainImage, alt: article.title }] : undefined,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: article.mainImage ? [article.mainImage] : undefined
    }
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const lang = await getRequestLang();
  const article = await getArticle(slug, lang);
  const articleUrl = `${SITE_URL}/articles/${article.slug}`;

  return (
    <main>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: article.title,
            description: article.summary,
            image: article.mainImage ? [article.mainImage] : undefined,
            datePublished: article.publishedAt,
            dateModified: article.updatedAt ?? article.publishedAt,
            mainEntityOfPage: articleUrl,
            author: {
              "@type": "Organization",
              name: SITE_NAME
            },
            publisher: {
              "@type": "Organization",
              name: SITE_NAME,
              url: SITE_URL
            }
          })
        }}
      />
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
