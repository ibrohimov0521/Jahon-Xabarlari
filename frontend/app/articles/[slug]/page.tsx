import type { Metadata } from "next";
import { ArrowRight, Clock3, Eye, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleActions } from "../../../components/ArticleActions";
import { AdPlacement } from "../../../components/AdPlacement";
import { ArticleViewTracker } from "../../../components/ArticleViewTracker";
import { CommentSection } from "../../../components/CommentSection";
import { Header } from "../../../components/Header";
import { NewsCard } from "../../../components/NewsCard";
import { MediaView } from "../../../components/MediaView";
import { getActiveAdvertisement, getArticle, getArticleContext, getComments } from "../../../lib/api";
import { formatArticleDateTime, formatViews } from "../../../lib/format";
import { serializeJsonLd } from "../../../lib/json-ld";
import { getRequestLang } from "../../../lib/server-lang";
import { displayArticleTitle, withoutRepeatedArticleHeading } from "../../../lib/article-content";
import { SITE_LOGO_SQUARE, SITE_NAME, SITE_OG_IMAGE, SITE_URL } from "../../../lib/site";
import { localizedHref } from "../../../lib/localized-href";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
};

function ArticleMedia({ src, alt, className = "", eager = false }: { src?: string | null; alt: string; className?: string; eager?: boolean }) {
  return (
    <MediaView
      src={src}
      alt={alt}
      className={className}
      videoClassName={className}
      priority={eager}
      optimizedWidth={1920}
      sizes="(max-width: 1024px) calc(100vw - 20px), 960px"
    />
  );
}

function readingMinutes(content: string) {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 180));
}

function localizedArticleUrl(slug: string, lang: "uz" | "ru" | "en") {
  const url = `${SITE_URL}/articles/${slug}`;
  return lang === "uz" ? url : `${url}?lang=${lang}`;
}

function parseExternalHttpUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const articleCopy = {
  uz: { editorial: "tahririyati", read: "daqiqa o'qish", source: "Manba", continue: "Mavzuni davom ettiring", related: "O'xshash yangiliklar", all: "Barchasi", next: "Keyingi yangilik" },
  ru: { editorial: "редакция", read: "мин. чтения", source: "Источник", continue: "Продолжить тему", related: "Похожие новости", all: "Все", next: "Следующая новость" },
  en: { editorial: "editorial team", read: "min read", source: "Source", continue: "Continue this topic", related: "Related news", all: "All", next: "Next story" }
} as const;

const articleCategoryLabels: Record<"ru" | "en", Record<string, string>> = {
  ru: { ozbekiston: "Узбекистан", dunyo: "Мир", siyosat: "Политика", iqtisodiyot: "Экономика", texnologiya: "Технологии", sport: "Спорт", madaniyat: "Культура" },
  en: { ozbekiston: "Uzbekistan", dunyo: "World", siyosat: "Politics", iqtisodiyot: "Business", texnologiya: "Technology", sport: "Sport", madaniyat: "Culture" }
};

export async function generateMetadata({ params, searchParams }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const requestedLang = (await searchParams).lang;
  const canonicalLang = await getRequestLang(requestedLang);
  const article = await getArticle(slug, canonicalLang);
  if (!article) return {};
  const contentLang = article.contentLanguage ?? canonicalLang;
  const displayedTitle = displayArticleTitle(article.title, article.content);
  const title = article.seoTitle && article.seoTitle !== article.title ? article.seoTitle : displayedTitle;
  const description = article.seoDescription || article.shortDescription || article.summary;
  const url = localizedArticleUrl(article.slug, contentLang);
  const baseUrl = `${SITE_URL}/articles/${article.slug}`;
  const images = [article.mainImage, ...(article.gallery ?? [])].filter(Boolean) as string[];
  const languages: Record<string, string> = { uz: baseUrl, "x-default": baseUrl };
  for (const language of article.availableLanguages ?? ["uz"]) {
    if (language !== "uz") languages[language] = `${baseUrl}?lang=${language}`;
  }

  return {
    title,
    description,
    keywords: article.seoKeywords?.split(",").map((item) => item.trim()).filter(Boolean),
    alternates: {
      canonical: url,
      languages
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: SITE_NAME,
      locale: contentLang === "uz" ? "uz_UZ" : contentLang === "ru" ? "ru_RU" : "en_US",
      images: images.length ? images.map((image) => ({ url: image, alt: article.title })) : [{ url: SITE_OG_IMAGE, alt: SITE_NAME }],
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: article.author?.name ? [article.author.name] : undefined,
      tags: article.tags?.map((item) => item.tag.name)
    },
    twitter: { card: "summary_large_image", title, description, images: images.length ? images : [SITE_OG_IMAGE] }
  };
}

export default async function ArticlePage({ params, searchParams }: ArticlePageProps) {
  const { slug } = await params;
  const requestedLang = (await searchParams).lang;
  const lang = await getRequestLang(requestedLang);
  const article = await getArticle(slug, lang);
  if (!article) notFound();

  const contentLang = article.contentLanguage ?? lang;
  const copy = articleCopy[lang];
  const categoryName = lang === "uz" ? article.category?.name : articleCategoryLabels[lang][article.category?.slug ?? ""] ?? article.category?.name;
  const articleUrl = localizedArticleUrl(article.slug, contentLang);
  const articleDescription = article.shortDescription || article.summary;
  const displayedTitle = displayArticleTitle(article.title, article.content);
  const articleBody = withoutRepeatedArticleHeading(article.content, displayedTitle);
  const images = [article.mainImage, ...(article.gallery ?? [])].filter(Boolean) as string[];
  const [comments, context, inlineDesktopAd, inlineMobileAd, bottomDesktopAd, bottomMobileAd] = await Promise.all([
    getComments(article.id),
    getArticleContext(article.slug, lang),
    getActiveAdvertisement("ARTICLE_INLINE", "desktop"),
    getActiveAdvertisement("ARTICLE_INLINE", "mobile"),
    getActiveAdvertisement("ARTICLE_BOTTOM", "desktop"),
    getActiveAdvertisement("ARTICLE_BOTTOM", "mobile")
  ]);
  const readTime = readingMinutes(articleBody);
  const tags = article.tags?.map((item) => item.tag) ?? [];
  const sourceUrl = parseExternalHttpUrl(article.sourceUrl);

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
            headline: displayedTitle,
            description: articleDescription,
            image: images.length ? images : undefined,
            datePublished: article.publishedAt,
            dateModified: article.updatedAt ?? article.publishedAt,
            inLanguage: contentLang,
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
            <span className="article-category-badge">{categoryName}</span>
            {tags.slice(0, 4).map((tag) => <span className="article-tag" key={tag.slug}>#{tag.name}</span>)}
          </div>
          <h1 className="article-title mt-4 text-[27px] font-black leading-tight sm:text-4xl lg:text-[44px]">{displayedTitle}</h1>
          <div className="article-trust-row mt-5">
            <span><UserRound size={15} /> {article.author?.name || `${SITE_NAME} ${copy.editorial}`}</span>
            <span><Clock3 size={15} /> {formatArticleDateTime(article.publishedAt, lang)}</span>
            <span><Eye size={15} /> {formatViews(article.viewsCount, lang)}</span>
            <span>{readTime} {copy.read}</span>
          </div>
          <ArticleActions articleId={article.id} title={displayedTitle} url={articleUrl} />
        </header>

        {article.mainImage && (
          <div className="article-main-frame mt-6 rounded-lg bg-black/80 news-shadow">
            <ArticleMedia src={article.mainImage} alt={article.title} className="article-main-media" eager />
            <span aria-hidden="true" className="brand-media-watermark brand-media-watermark-detail" />
          </div>
        )}
        {!!article.gallery?.length && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {article.gallery.map((src) => (
              <div key={src} className="article-gallery-frame rounded-lg bg-black/80 news-shadow">
                <ArticleMedia src={src} alt={article.title} className="article-gallery-media" />
                <span aria-hidden="true" className="brand-media-watermark brand-media-watermark-detail" />
              </div>
            ))}
          </div>
        )}

        <div className="article-body mt-6 rounded-lg border border-slate-200 bg-white p-5 news-shadow sm:p-8">
          <div className="article-copy whitespace-pre-line">{articleBody}</div>
          {(article.sourceName || sourceUrl) && (
            <div className="article-source mt-8">
              <span>{copy.source}</span>
              {sourceUrl ? (
                <a href={sourceUrl.href} target="_blank" rel="nofollow noreferrer">{article.sourceName || sourceUrl.hostname}</a>
              ) : <strong>{article.sourceName}</strong>}
            </div>
          )}
          <AdPlacement desktop={inlineDesktopAd} mobile={inlineMobileAd} className="mt-8" />
          <CommentSection articleId={article.id} initialComments={comments} />
        </div>

        <AdPlacement desktop={bottomDesktopAd} mobile={bottomMobileAd} className="mt-7" />

        {!!context.related.length && (
          <section className="mt-9" aria-labelledby="related-title">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-brand">{copy.continue}</p>
                <h2 id="related-title" className="mt-1 text-2xl font-black">{copy.related}</h2>
              </div>
              {article.category?.slug && <Link href={localizedHref(`/category/${article.category.slug}`, lang)} className="hidden items-center gap-2 text-sm font-black text-brand sm:inline-flex">{copy.all} <ArrowRight size={16} /></Link>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {context.related.slice(0, 6).map((item) => <NewsCard article={item} language={lang} key={item.id} />)}
            </div>
          </section>
        )}

        {context.next && (
          <Link href={localizedHref(`/articles/${context.next.slug}`, lang)} className="article-next mt-7">
            <span><small>{copy.next}</small><strong>{context.next.title}</strong></span>
            <ArrowRight size={22} />
          </Link>
        )}
      </article>
    </main>
  );
}
