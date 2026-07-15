import type { Article } from "../lib/api";
import { formatDateCompact, formatViewsCompact } from "../lib/format";
import { Clock, Eye } from "lucide-react";
import Link from "next/link";
import { MediaView } from "./MediaView";

type SupportedLanguage = "uz" | "ru" | "en";

const categoryLabels: Record<"ru" | "en", Record<string, string>> = {
  ru: { ozbekiston: "Узбекистан", dunyo: "Мир", siyosat: "Политика", iqtisodiyot: "Экономика", texnologiya: "Технологии", sport: "Спорт", madaniyat: "Культура" },
  en: { ozbekiston: "Uzbekistan", dunyo: "World", siyosat: "Politics", iqtisodiyot: "Business", texnologiya: "Technology", sport: "Sport", madaniyat: "Culture" }
};

export function NewsCard({ article, language = "uz" }: { article: Article; language?: SupportedLanguage }) {
  const categoryName = language === "uz" ? article.category?.name : categoryLabels[language][article.category?.slug ?? ""] ?? article.category?.name;
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="news-card-modern news-shadow flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:-translate-y-0.5"
    >
      <MediaView src={article.mainImage} className="news-card-media h-[130px] w-full object-cover sm:h-[152px]" />
      <div className="news-card-body flex flex-1 flex-col p-2.5 sm:p-4">
        {categoryName && (
          <span className="news-card-badge w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand">
            {categoryName}
          </span>
        )}
        <h3 className="mt-1.5 line-clamp-2 text-[14.5px] font-extrabold leading-tight sm:mt-2 sm:text-[16px] sm:leading-snug">{article.title}</h3>

        {/* Mobile: original summary only (no AI). Desktop: AI short description when available. */}
        {article.summary && (
          <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-slate-500 lg:hidden">{article.summary}</p>
        )}
        {(article.shortDescription || article.summary) && (
          <p className="mt-2 line-clamp-2 hidden text-sm font-semibold leading-5 text-slate-500 lg:block">
            {article.shortDescription || article.summary}
          </p>
        )}

        <p className="news-card-meta mt-auto flex items-center gap-3 pt-2 text-[11px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {formatDateCompact(article.publishedAt, language)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye size={12} /> {formatViewsCompact(article.viewsCount)}
          </span>
        </p>
      </div>
    </Link>
  );
}
