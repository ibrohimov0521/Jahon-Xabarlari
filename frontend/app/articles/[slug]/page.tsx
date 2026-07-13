import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommentSection } from "../../../components/CommentSection";
import { ArticleViewTracker } from "../../../components/ArticleViewTracker";
import { Header } from "../../../components/Header";
import { getArticle, getComments } from "../../../lib/api";
import { formatArticleDateTime, formatViews } from "../../../lib/format";
import { isVideoUrl, toOptimizedImageSrc } from "../../../lib/media";
import { serializeJsonLd } from "../../../lib/json-ld";
import { getRequestLang } from "../../../lib/server-lang";
import { SITE_LOGO_SQUARE, SITE_NAME, SITE_OG_IMAGE, SITE_URL } from "../../../lib/site";

type ArticlePageProps = { params: Promise<{ slug: string }> };

function ArticleMedia({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  if (!src) return null;
  if (isVideoUrl(src)) {
    return (
      <video className={className} controls muted playsInline preload="metadata">
        <source src={src} />
      </video>
    );
  }
  // Serve the photo through our origin's optimizer so readers whose network can't reach the
  // source CDN directly (regional blocks) still load it -- same reason the homepage feed does.
  return <img src={toOptimizedImageSrc(src)} alt={alt} className={className} loading="eager" decoding="async" />;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getRequestLang();
  const article = await getArticle(slug, lang);
  if (!article) return {};
  const title = article.seoTitle || article.title;
  const articleDescription = article.shortDescription || article.summary;
  const description = article.seoDescription || articleDescription;
  const url = `${SITE_URL}/articles/${article.slug}`;
  const images = [article.mainImage, ...(article.gallery ?? [])].filter(Boolean) as string[];

  return {
    title,
    description,
    keywords: article.seoKeywords?.split(",").map((item) => item.trim()).filter(Boolean),
    alternates: {
      canonical: url
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: SITE_NAME,
      images: images.length ? images.map((image) => ({ url: image, alt: article.title })) : [{ url: SITE_OG_IMAGE, alt: SITE_NAME }],
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.length ? images : [SITE_OG_IMAGE]
    }
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const lang = await getRequestLang();
  const article = await getArticle(slug, lang);
  if (!article) notFound();
  const articleUrl = `${SITE_URL}/articles/${article.slug}`;
  const articleDescription = article.shortDescription || article.summary;
  const images = [article.mainImage, ...(article.gallery ?? [])].filter(Boolean) as string[];
  const comments = await getComments(article.id);

  return (
    <main>
      <ArticleViewTracker articleId={article.id} />
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: article.title,
            description: articleDescription,
            image: images.length ? images : undefined,
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
              url: SITE_URL,
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}${SITE_LOGO_SQUARE}`,
                width: 512,
                height: 512
              }
            }
          })
        }}
      />
      <article className="container-page max-w-4xl py-8">
        <div className="article-detail-panel rounded-lg border border-slate-200 bg-white p-5 news-shadow sm:p-7">
          <span className="font-black uppercase text-brand">{article.category?.name}</span>
          <p className="mt-3 text-sm font-bold text-slate-500">
            {formatArticleDateTime(article.publishedAt)} &nbsp;•&nbsp; {formatViews(article.viewsCount)}
          </p>
          <h1 className="article-title mt-3 text-[25px] font-black leading-tight sm:text-3xl lg:text-4xl">{article.title}</h1>
          {/* The AI/summary block is desktop-only; mobile goes straight from the title to the photo & content. */}
          <p className="article-summary mt-4 hidden text-lg lg:block">{articleDescription}</p>
        </div>
        {article.mainImage && (
          <div className="article-main-frame mt-7 rounded-lg bg-black/80 news-shadow">
            <ArticleMedia src={article.mainImage} alt={article.title} className="article-main-media" />
          </div>
        )}
        {!!article.gallery?.length && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {article.gallery.map((src) => (
              <div key={src} className="article-gallery-frame rounded-lg bg-black/80 news-shadow">
                <ArticleMedia src={src} alt={article.title} className="article-gallery-media" />
              </div>
            ))}
          </div>
        )}
        <div className="article-body prose prose-lg mt-8 max-w-none rounded-lg border border-slate-200 bg-white p-5 news-shadow sm:p-7">
          <p>{article.content}</p>
          {article.sourceName && <p className="mt-6 text-xs text-slate-400">Manba: {article.sourceName}</p>}
          <CommentSection articleId={article.id} initialComments={comments} />
        </div>
      </article>
    </main>
  );
}
