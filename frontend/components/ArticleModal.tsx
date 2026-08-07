"use client";

import { ArrowRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatArticleDateTime, formatViews } from "../lib/format";
import { displayArticleTitle, withoutRepeatedArticleHeading } from "../lib/article-content";
import type { Article } from "../lib/api";
import { API_URL } from "../lib/config";
import { useUi } from "../lib/ui-context";
import { MediaView } from "./MediaView";
import { CommentSection } from "./CommentSection";
import { recordArticleView } from "../lib/api";
import { useScrollLock } from "../lib/use-scroll-lock";

export function ArticleModal() {
  const { language } = useUi();
  const copy = {
    uz: { loading: "Yuklanmoqda...", close: "Yopish", full: "To'liq sahifada ochish" },
    ru: { loading: "Загрузка...", close: "Закрыть", full: "Открыть полную страницу" },
    en: { loading: "Loading...", close: "Close", full: "Open full page" }
  }[language];
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(false);
  // Guards against out-of-order responses: if the user opens article B before article A's
  // fetch resolves, A's stale response must not overwrite B once it lands.
  const requestIdRef = useRef(0);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const displayedLanguageRef = useRef(language);
  const modalOpen = Boolean(article || loading);

  useScrollLock(modalOpen);

  const loadArticle = useCallback((slug: string, trackView = true) => {
    const requestId = ++requestIdRef.current;
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    setLoading(true);
    const langQuery = language === "uz" ? "" : `?lang=${encodeURIComponent(language)}`;
    fetch(`${API_URL}/articles/${slug}${langQuery}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Maqola topilmadi");
        return res.json();
      })
      .then((data: Article) => {
        if (requestIdRef.current !== requestId) return;
        displayedLanguageRef.current = language;
        setArticle(data);
        if (trackView) {
          void recordArticleView(data.id).then((viewsCount) => {
            if (viewsCount !== null && requestIdRef.current === requestId) {
              setArticle((current) => current?.id === data.id ? { ...current, viewsCount } : current);
            }
          });
        }
      })
      .catch(() => {
        if (requestIdRef.current === requestId) setArticle(null);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (fetchControllerRef.current === controller) fetchControllerRef.current = null;
        if (requestIdRef.current === requestId) setLoading(false);
      });
  }, [language]);

  useEffect(() => {
    function onClick(event: globalThis.MouseEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (window.matchMedia("(max-width: 767px)").matches) return;
      if (window.location.pathname.startsWith("/articles/")) return;
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/articles/"], a[href*="/articles/"]');
      if (!link || link.target || link.dataset.fullPage === "true") return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/articles/")) return;
      const slug = url.pathname.split("/articles/")[1]?.split("/")[0];
      if (!slug) return;

      event.preventDefault();
      returnFocusRef.current = link;
      loadArticle(slug);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      fetchControllerRef.current?.abort();
    };
  }, [loadArticle]);

  useEffect(() => {
    if (article?.slug && displayedLanguageRef.current !== language) loadArticle(article.slug, false);
  }, [article?.slug, language, loadArticle]);

  useEffect(() => {
    if (!article && !loading) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, loading]);

  function close() {
    // Invalidate any in-flight fetch so it can't resurrect the modal after the user closed it.
    requestIdRef.current += 1;
    fetchControllerRef.current?.abort();
    fetchControllerRef.current = null;
    setArticle(null);
    setLoading(false);
    returnFocusRef.current?.focus();
    returnFocusRef.current = null;
  }

  if (!article && !loading) return null;

  return (
    <div className="fixed inset-0 z-[220] bg-slate-950/72 p-4 backdrop-blur-md" onClick={close} role="presentation">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-center">
        <article className="max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={article ? "article-modal-title" : undefined} aria-busy={loading}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 backdrop-blur">
            <span className="text-sm font-black text-brand">{article?.category?.name ?? (loading ? copy.loading : "")}</span>
            <button ref={closeButtonRef} onClick={close} className="article-modal-close grid size-10 place-items-center rounded-full border border-slate-200 text-ink hover:border-brand hover:text-brand" aria-label={copy.close}>
              <X size={20} />
            </button>
          </div>
          {loading && <div className="p-10 text-center text-lg font-black text-ink">{copy.loading}</div>}
          {article && (
            <div className="p-5 sm:p-7">
              <MediaView
                src={article.mainImage}
                alt={article.title}
                className="max-h-[58vh] h-auto w-full rounded-xl bg-black/80 object-contain"
                priority
                sizes="(max-width: 1024px) calc(100vw - 48px), 960px"
              />
              <p className="mt-5 text-sm font-bold text-slate-500">
                {formatArticleDateTime(article.publishedAt, language)} · {formatViews(article.viewsCount, language)}
              </p>
              <h1 id="article-modal-title" className="mt-3 text-3xl font-black leading-tight text-ink sm:text-4xl">{displayArticleTitle(article.title, article.content)}</h1>
              <div className="mt-6 whitespace-pre-line text-[17px] font-medium leading-8 text-ink">{withoutRepeatedArticleHeading(article.content, displayArticleTitle(article.title, article.content))}</div>
              <CommentSection key={article.id} articleId={article.id} initialComments={[]} />
              <a
                data-full-page="true"
                href={`/articles/${article.slug}${language === "uz" ? "" : `?lang=${encodeURIComponent(language)}`}`}
                onClick={close}
                className="mt-7 inline-flex h-11 items-center gap-3 rounded-md bg-brand px-5 font-black text-white"
              >
                {copy.full} <ArrowRight size={17} />
              </a>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
