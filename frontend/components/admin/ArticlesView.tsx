"use client";

import { Archive, CheckCircle2, Clock3, Edit3, Eye, FileText, Languages, MoreVertical, RotateCcw, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { formatArticleDateTime } from "../../lib/format";
import { ARTICLE_STATUSES, type Article, type ArticleStatus } from "./types";
import { Badge, ConfirmButton, Empty, Panel, SearchInput, SelectFilter } from "./ui";
import { MediaView } from "../MediaView";

const TRANSLATION_TONE: Record<string, "green" | "amber" | "red"> = { READY: "green", PENDING: "amber", FAILED: "red" };

const STATUS_META: Record<ArticleStatus, { label: string; tone: "brand" | "green" | "red" | "amber" | "slate"; icon: typeof FileText; hint: string }> = {
  DRAFT: { label: "Draft", tone: "slate", icon: FileText, hint: "Ichki tayyorlanayotgan maqola" },
  REVIEW: { label: "Review", tone: "amber", icon: ShieldCheck, hint: "Tekshiruv va tasdiqlash kutilmoqda" },
  PUBLISHED: { label: "Published", tone: "green", icon: CheckCircle2, hint: "Saytda ochiq ko'rinadi" },
  SCHEDULED: { label: "Scheduled", tone: "brand", icon: Clock3, hint: "Rejalashtirilgan nashr" },
  ARCHIVED: { label: "Archived", tone: "red", icon: Archive, hint: "Arxivda, faol oqimdan olingan" }
};

function StatusBadge({ status }: { status: ArticleStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-ink shadow-sm">
      <Icon size={14} className={status === "PUBLISHED" ? "text-green-600" : status === "REVIEW" ? "text-amber-500" : status === "ARCHIVED" ? "text-red-500" : "text-brand"} />
      {meta.label}
    </span>
  );
}

function ArticleThumb({ article }: { article: Article }) {
  if (!article.mainImage) {
    return (
      <div className="grid h-24 w-32 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 sm:h-28 sm:w-40">
        <FileText size={28} />
      </div>
    );
  }
  return (
    <MediaView
      src={article.mainImage}
      alt={article.title}
      className="h-24 w-32 shrink-0 rounded-lg border border-slate-200 bg-black/20 object-cover sm:h-28 sm:w-40"
      videoClassName="h-24 w-32 shrink-0 rounded-lg border border-slate-200 bg-black object-cover sm:h-28 sm:w-40"
    />
  );
}

export function ArticlesView({
  articles,
  trashed,
  onTrashedChange,
  onStatus,
  onTrash,
  onRestore,
  onPermanentDelete,
  onBulkTrash,
  onBulkRestore,
  onEdit,
  onPreview,
  onRegenerateTranslation,
  initialStatus = "",
  onlyToday = false
}: {
  articles: Article[];
  trashed: boolean;
  onTrashedChange: (trashed: boolean) => void;
  onStatus: (id: string, status: ArticleStatus) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onBulkTrash: (ids: string[]) => void;
  onBulkRestore: (ids: string[]) => void;
  onEdit: (id: string) => void;
  onPreview: (article: Article) => void;
  onRegenerateTranslation: (id: string, lang: string) => void;
  initialStatus?: ArticleStatus | "";
  onlyToday?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ArticleStatus | "">(initialStatus);
  const [selected, setSelected] = useState<string[]>([]);
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus);
    setSelected([]);
    setOpenStatusId(null);
  }, [initialStatus, onlyToday]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return articles.filter((item) => {
      if (status && item.status !== status) return false;
      if (onlyToday && new Date(item.createdAt) < today) return false;
      if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [articles, onlyToday, search, status]);

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.length === filtered.length ? [] : filtered.map((item) => item.id)));
  }

  function changeStatus(id: string, nextStatus: ArticleStatus) {
    setOpenStatusId(null);
    onStatus(id, nextStatus);
  }

  return (
    <Panel
      title={trashed ? "Trash" : "Yangiliklar"}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {onlyToday && <Badge tone="green">Bugun qo'shilganlar</Badge>}
          <SearchInput value={search} onChange={setSearch} placeholder="Sarlavha bo'yicha qidirish..." />
          {!trashed && <SelectFilter value={status} onChange={setStatus} options={ARTICLE_STATUSES} allLabel="Barcha statuslar" />}
          <button
            onClick={() => {
              onTrashedChange(!trashed);
              setSelected([]);
              setOpenStatusId(null);
            }}
            className={`rounded-full border px-4 py-2 text-sm font-black transition hover:border-brand ${trashed ? "border-brand text-brand" : "border-slate-200"}`}
          >
            {trashed ? "Faol maqolalar" : "Trash"}
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <label className="inline-flex items-center gap-3 text-sm font-black">
          <input type="checkbox" checked={selected.length > 0 && selected.length === filtered.length} onChange={toggleSelectAll} className="size-4 accent-blue-600" />
          {filtered.length} ta yangilik
        </label>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-brand">
            {selected.length} ta tanlandi
            {trashed ? (
              <button
                onClick={() => {
                  onBulkRestore(selected);
                  setSelected([]);
                }}
                className="rounded-full bg-brand px-4 py-2 text-white"
              >
                Tiklash
              </button>
            ) : (
              <button
                onClick={() => {
                  onBulkTrash(selected);
                  setSelected([]);
                }}
                className="rounded-full bg-red-600 px-4 py-2 text-white"
              >
                Trashga yuborish
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3">
        {filtered.map((item) => {
          const nextStatuses = ARTICLE_STATUSES.filter((nextStatus) => nextStatus !== item.status);
          return (
            <article key={item.id} className="group relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 gap-3">
                  <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} className="mt-2 size-4 shrink-0 accent-blue-600" />
                  <ArticleThumb article={item} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      <Badge tone="slate">{item.category?.name ?? "Kategoriya yo'q"}</Badge>
                      {item.sourceName && <Badge tone="slate">AI: {item.sourceName}</Badge>}
                    </div>
                    <h4 className="line-clamp-2 text-base font-black leading-6 text-ink sm:text-lg">{item.title}</h4>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-500">{item.summary}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-500">
                      <span>{formatArticleDateTime(item.updatedAt)}</span>
                      <span>{item.viewsCount} ko'rish</span>
                      {[item.isBreaking && "Breaking", item.isFeatured && "Featured", item.isEditorChoice && "Editor"].filter(Boolean).map((flag) => (
                        <span key={String(flag)} className="rounded-full bg-blue-50 px-2 py-1 text-brand">
                          {flag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {["ru", "en"].map((lang) => {
                        const info = item.translations?.find((t) => t.lang === lang);
                        if (!info) return null;
                        return (
                          <button
                            key={lang}
                            disabled={info.status !== "FAILED"}
                            onClick={() => onRegenerateTranslation(item.id, lang)}
                            className="transition disabled:cursor-default disabled:opacity-100"
                            title={`${lang.toUpperCase()}: ${info.status}${info.status === "FAILED" ? " - qayta urinish uchun bosing" : ""}`}
                          >
                            <Badge tone={TRANSLATION_TONE[info.status] ?? "slate"}>
                              <span className="inline-flex items-center gap-1">
                                <Languages size={12} /> {lang.toUpperCase()}
                              </span>
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-2 md:self-stretch">
                  <button onClick={() => onPreview(item)} className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white transition hover:border-brand hover:text-brand" title="Ko'rish">
                    <Eye size={18} />
                  </button>
                  <button onClick={() => onEdit(item.id)} className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white transition hover:border-brand hover:text-brand" title="Tahrirlash">
                    <Edit3 size={18} />
                  </button>

                  {!trashed && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenStatusId((current) => (current === item.id ? null : item.id))}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-black transition hover:border-brand hover:text-brand"
                        title="Statusni o'zgartirish"
                      >
                        <Send size={16} />
                        Status
                        <MoreVertical size={16} />
                      </button>
                      {openStatusId === item.id && (
                        <div className="absolute right-0 top-12 z-[120] w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                          <div className="px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500">Statusni o'zgartirish</div>
                          {nextStatuses.map((nextStatus) => {
                            const meta = STATUS_META[nextStatus];
                            const Icon = meta.icon;
                            return (
                              <button
                                key={nextStatus}
                                onClick={() => changeStatus(item.id, nextStatus)}
                                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50 hover:text-brand"
                              >
                                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-brand">
                                  <Icon size={16} />
                                </span>
                                <span>
                                  <span className="block text-sm font-black">{meta.label}</span>
                                  <span className="mt-0.5 block text-xs font-semibold leading-4 text-slate-500">{meta.hint}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {trashed ? (
                    <>
                      <button onClick={() => onRestore(item.id)} className="grid size-10 place-items-center rounded-full bg-brand text-white transition hover:bg-blue-700" title="Tiklash">
                        <RotateCcw size={18} />
                      </button>
                      <ConfirmButton label={<Trash2 size={16} />} confirmLabel="Butunlay o'chirish" onConfirm={() => onPermanentDelete(item.id)} />
                    </>
                  ) : (
                    <ConfirmButton label={<Trash2 size={16} />} confirmLabel="Trash" onConfirm={() => onTrash(item.id)} />
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {!filtered.length && <Empty text={trashed ? "Trash bo'sh" : "Bazadagi yangiliklar bo'sh. Yangi maqola qo'shishingiz mumkin."} />}
      </div>
    </Panel>
  );
}

export async function fetchArticles(trashed: boolean) {
  return adminRequest<{ items: Article[] }>(`/admin/articles${trashed ? "?trashed=true" : ""}`);
}
