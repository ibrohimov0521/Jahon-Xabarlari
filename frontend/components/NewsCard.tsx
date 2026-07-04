import type { Article } from "../lib/api";
import Link from "next/link";
import { MediaView } from "./MediaView";

export function NewsCard({ article }: { article: Article }) {
  return (
    <Link href={`/articles/${article.slug}`} className="news-shadow overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:-translate-y-0.5">
      <MediaView src={article.mainImage} className="h-[152px] w-full object-cover" />
      <div className="p-4">
        <span className="text-[12px] font-black uppercase text-brand">{article.category?.name}</span>
        <h3 className="mt-2 min-h-[52px] text-[17px] font-black leading-snug">{article.title}</h3>
        <p className="mt-5 text-[14px] text-slate-500">12 May, 2025&nbsp;&nbsp; • &nbsp;&nbsp;11:20&nbsp;&nbsp; 👁 &nbsp;{Math.round(article.viewsCount / 100) / 10} ming</p>
      </div>
    </Link>
  );
}
