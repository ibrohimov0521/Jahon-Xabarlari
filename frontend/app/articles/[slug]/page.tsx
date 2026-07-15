import type { Metadata } from "next";
import { ArrowRight, Clock3, Eye, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleActions } from "../../../components/ArticleActions";
import { ArticleViewTracker } from "../../../components/ArticleViewTracker";
import { CommentSection } from "../../../components/CommentSection";
import { Header } from "../../../components/Header";
import { NewsCard } from "../../../components/NewsCard";
import { MediaView } from "../../../components/MediaView";
import { getArticle, getArticleContext, getComments } from "../../../lib/api";
import { formatArticleDateTime, formatViews } from "../../../lib/format";
import { serializeJsonLd } from "../../../lib/json-ld";
import { getRequestLang } from "../../../lib/server-lang";
import { SITE_LOGO_SQUARE, SITE_NAME, SITE_OG_IMAGE, SITE_URL } from "../../../lib/site";

type ArticlePageProps = { params: Promise<{ slug: string }> };

function ArticleMedia({ src, alt, className = "", eager = false }: { src?: string | null; alt: string; className?: string; eager?: boolean }) {
  return <MediaView src={src} alt={alt} className={className} videoClassName={className} priority={eager} optimizedWidth={1920} />;
}

function readingMinutes(content: string) {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 180));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const lang = await getRequestLang();
  const article = await getArticle(slug, lang);
  if (!article) return {};
  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.shortDescription || article.summary;
  const url = `${SITE_URL}/articles/${article.slug}`;
  const images = [article.mainImage, ...(article.gallery ?? [])].filter(Boolean) as string[];

  return {
    title,
    description,
    keywords: article.seoKeywords?.split(",").map((item) => item.trim()).filter(Boolean),
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: SITE_NAME,
      images: images.length ? images.map((image) => ({ url: image, alt: article.title })) : [{ url: SITE_OG_IMAGE, alt: SITE_NAME }],
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: article.author?.name ? [article.author.name] : undefined,
      tags: article.tags?.map((item) => item.tag.name)
    },
    twitter: { card: "summary_large_image", title, description, images: images.length ? images : [SITE_OG_IMAGE] }
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
  const [comments, context] = await Promise.all([getComments(article.id), getArticleContext(article.slug, lang)]);
  const readTime = readingMinutes(article.content);
  const tags = article.tags?.map((item) => item.tag) ?? [];

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
            author: article.author?.name
              ? { "@type": "Person", name: article.author.name }
              : { "@type": "Organization", name: SITE_NAME },
            publisher: {
              "@type": "Organization",
              name: SITE_NAME,
              url: SITE_URL,
              logo: { "@type": "ImageObject", url: `${SITE_URL}${SITE_LOGO_SQUARE}`, width: 512, height: 512 }
            }
          })
        }}
      />

      <article className="container-page article-page max-w-5xl py-6 sm:py-9">
        <header className="article-detail-panel rounded-lg border border-slate-200 bg-white p-5 news-shadow sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="article-category-badge">{article.category?.name}</span>
            {tags.slice(0, 4).map((tag) => <span className="article-tag" key={tag.slug}>#{tag.name}</span>)}
          </div>
          <h1 className="article-title mt-4 text-[27px] font-black leading-tight sm:text-4xl lg:text-[44px]">{article.title}</h1>
          <p className="article-summary mt-4 text-base leading-7 sm:text-lg">{articleDescription}</p>
          <div className="article-trust-row mt-5">
            <span><UserRound size={15} /> {article.author?.name || `${SITE_NAME} tahririyati`}</span>
            <span><Clock3 size={15} /> {formatArticleDateTime(article.publishedAt)}</span>
            <span><Eye size={15} /> {formatViews(article.viewsCount)}</span>
            <span>{readTime} daqiqa o'qish</span>
          </div>
          <ArticleActions articleId={article.id} title={article.title} url={articleUrl} />
        </header>

        {article.mainImage && (
          <div className="article-main-frame mt-6 rounded-lg bg-black/80 news-shadow">
            <ArticleMedia src={article.mainImage} alt={article.title} className="article-main-media" eager />
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

        <div className="article-body mt-6 rounded-lg border border-slate-200 bg-white p-5 news-shadow sm:p-8">
          <div className="article-copy whitespace-pre-line">{article.content}</div>
          {(article.sourceName || article.sourceUrl) && (
            <div className="article-source mt-8">
              <span>Manba</span>
              {article.sourceUrl ? (
                <a href={article.sourceUrl} target="_blank" rel="nofollow noreferrer">{article.sourceName || new URL(article.sourceUrl).hostname}</a>
              ) : <strong>{article.sourceName}</strong>}
            </div>
          )}
          <CommentSection articleId={article.id} initialComments={comments} />
        </div>

        {!!context.related.length && (
          <section className="mt-9" aria-labelledby="related-title">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-brand">Mavzuni davom ettiring</p>
                <h2 id="related-title" className="mt-1 text-2xl font-black">O'xshash yangiliklar</h2>
              </div>
              {article.category?.slug && <Link href={`/category/${article.category.slug}`} className="hidden items-center gap-2 text-sm font-black text-brand sm:inline-flex">Barchasi <ArrowRight size={16} /></Link>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {context.related.slice(0, 6).map((item) => <NewsCard article={item} key={item.id} />)}
            </div>
          </section>
        )}

        {context.next && (
          <Link href={`/articles/${context.next.slug}`} className="article-next mt-7">
            <span><small>Keyingi yangilik</small><strong>{context.next.title}</strong></span>
            <ArrowRight size={22} />
          </Link>
        )}
      </article>
    </main>
  );
}
