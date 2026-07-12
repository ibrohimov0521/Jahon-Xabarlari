import type { Article } from "../lib/api";
import { formatDateCompact, formatViewsCompact } from "../lib/format";
import { Clock, Eye } from "lucide-react";
import Link from "next/link";
import { MediaView } from "./MediaView";

export function NewsCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="news-card-modern news-shadow flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:-translate-y-0.5"
    >
      <MediaView src={article.mainImage} className="news-card-media h-[130px] w-full object-cover sm:h-[152px]" />
      <div className="news-card-body flex flex-1 flex-col p-2.5 sm:p-4">
        {article.category?.name && (
          <span className="news-card-badge w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand">
            {article.category.name}
          </span>
        )}
        <h3 className="mt-1.5 line-clamp-2 text-[14.5px] font-black leading-tight sm:mt-2 sm:text-[16px] sm:leading-snug">{article.title}</h3>

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
            <Clock size={12} /> {formatDateCompact(article.publishedAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye size={12} /> {formatViewsCompact(article.viewsCount)}
          </span>
        </p>
      </div>
    </Link>
  );
}
