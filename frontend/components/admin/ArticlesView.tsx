"use client";

import { Archive, CheckCircle2, Clock3, Edit3, Eye, FileText, Languages, MoreVertical, RotateCcw, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { adminRequest } from "../../lib/admin-api";
import { formatArticleDateTime } from "../../lib/format";
import { ARTICLE_STATUSES, type Article, type ArticleStatus } from "./types";
import { Badge, Button, ConfirmButton, Empty, Pagination, Panel, SearchInput, SelectFilter } from "./ui";
import { MediaView } from "../MediaView";

// datetime-local expects a LOCAL wall-clock string; toISOString() is UTC, so slicing it directly
// would offset the minimum bound by the timezone. Shift by the offset first.
function localDateTimeValue(ms: number) {
  const date = new Date(ms);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const TRANSLATION_TONE: Record<string, "green" | "amber" | "red"> = { READY: "green", PENDING: "amber", FAILED: "red" };
const BULK_STATUS_ID = "__bulk_status__";

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
  onBulkStatus,
  onEdit,
  onPreview,
  onRegenerateTranslation,
  page,
  pages,
  total,
  onPageChange,
  onFiltersChange,
  initialStatus = "",
  onlyToday = false
}: {
  articles: Article[];
  trashed: boolean;
  onTrashedChange: (trashed: boolean) => void;
  onStatus: (id: string, status: ArticleStatus, scheduledAt?: string) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onBulkTrash: (ids: string[]) => void;
  onBulkRestore: (ids: string[]) => void;
  onBulkStatus: (ids: string[], status: ArticleStatus, scheduledAt?: string) => void;
  onEdit: (id: string) => void;
  onPreview: (article: Article) => void;
  onRegenerateTranslation: (id: string, lang: string) => void;
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
  onFiltersChange: (search: string, status: ArticleStatus | "") => void;
  initialStatus?: ArticleStatus | "";
  onlyToday?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ArticleStatus | "">(initialStatus);
  const [selected, setSelected] = useState<string[]>([]);
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [scheduleTargetId, setScheduleTargetId] = useState<string | null>(null);
  const [scheduleValue, setScheduleValue] = useState("");
  const [mounted, setMounted] = useState(false);
  const [bulkMenuPosition, setBulkMenuPosition] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bulkStatusButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setStatus(initialStatus);
    setSelected([]);
    setOpenStatusId(null);
    setScheduleTargetId(null);
  }, [initialStatus, onlyToday]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  useEffect(() => {
    const visibleIds = new Set(articles.map((article) => article.id));
    setSelected((current) => current.filter((id) => visibleIds.has(id)));
  }, [articles]);

  // Dismiss the status dropdown on outside click or Escape.
  useEffect(() => {
    if (!openStatusId) return;
    function close() {
      setOpenStatusId(null);
      setScheduleTargetId(null);
    }
    function onDown(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest("[data-status-menu]")) close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openStatusId]);

  useEffect(() => {
    if (openStatusId !== BULK_STATUS_ID) {
      setBulkMenuPosition(null);
      return;
    }

    function updatePosition() {
      const anchor = bulkStatusButtonRef.current;
      if (!anchor) return;

      const viewportPadding = 16;
      const menuGap = 8;
      const menuWidth = Math.min(288, window.innerWidth - viewportPadding * 2);
      const rect = anchor.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - menuGap;
      const spaceAbove = rect.top - viewportPadding - menuGap;
      const placeAbove = spaceBelow < 320 && spaceAbove > spaceBelow;
      const left = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding
      );

      setBulkMenuPosition({
        left,
        ...(placeAbove
          ? { bottom: window.innerHeight - rect.top + menuGap }
          : { top: rect.bottom + menuGap }),
        maxHeight: Math.max(180, placeAbove ? spaceAbove : spaceBelow)
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [openStatusId]);

  const filtered = articles;

  function changeSearch(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => onFiltersChange(value, status), 300);
  }

  function changeFilterStatus(value: ArticleStatus | "") {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setStatus(value);
    onFiltersChange(search, value);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((item) => selected.includes(item.id));

  function toggleSelectAll() {
    setSelected(allFilteredSelected ? [] : filtered.map((item) => item.id));
  }

  function changeStatus(id: string, nextStatus: ArticleStatus) {
    if (nextStatus === "SCHEDULED") {
      setScheduleTargetId(id);
      setScheduleValue("");
      return;
    }
    setOpenStatusId(null);
    onStatus(id, nextStatus);
  }

  function confirmSchedule(id: string) {
    if (!scheduleValue) return;
    onStatus(id, "SCHEDULED", new Date(scheduleValue).toISOString());
    setScheduleTargetId(null);
    setOpenStatusId(null);
  }

  function changeBulkStatus(nextStatus: ArticleStatus) {
    if (nextStatus === "SCHEDULED") {
      setScheduleTargetId(BULK_STATUS_ID);
      setScheduleValue("");
      return;
    }
    onBulkStatus(selected, nextStatus);
    setSelected([]);
    setOpenStatusId(null);
  }

  function confirmBulkSchedule() {
    if (!scheduleValue) return;
    onBulkStatus(selected, "SCHEDULED", new Date(scheduleValue).toISOString());
    setSelected([]);
    setScheduleTargetId(null);
    setOpenStatusId(null);
  }

  const bulkStatusMenuContent = scheduleTargetId === BULK_STATUS_ID ? (
    <div className="p-2">
      <div className="px-1 pb-2 text-xs font-black uppercase tracking-wide text-slate-500">Umumiy nashr sanasi</div>
      <input
        type="datetime-local"
        value={scheduleValue}
        onChange={(event) => setScheduleValue(event.target.value)}
        min={localDateTimeValue(Date.now() + 60_000)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-brand"
      />
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => setScheduleTargetId(null)}>
          Bekor qilish
        </Button>
        <Button size="sm" className="flex-1" disabled={!scheduleValue} onClick={confirmBulkSchedule}>
          Rejalashtirish
        </Button>
      </div>
    </div>
  ) : (
    <>
      <div className="px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500">Barchasiga status berish</div>
      {ARTICLE_STATUSES.map((nextStatus) => {
        const meta = STATUS_META[nextStatus];
        const Icon = meta.icon;
        return (
          <button
            key={nextStatus}
            onClick={() => changeBulkStatus(nextStatus)}
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
    </>
  );

  return (
    <Panel
      title={trashed ? "Trash" : "Yangiliklar"}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {onlyToday && <Badge tone="green">Bugun qo'shilganlar</Badge>}
          <SearchInput value={search} onChange={changeSearch} placeholder="Sarlavha bo'yicha qidirish..." />
          {!trashed && <SelectFilter value={status} onChange={changeFilterStatus} options={ARTICLE_STATUSES} allLabel="Barcha statuslar" />}
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
          <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="size-4 accent-blue-600" />
          {total} ta yangilik
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
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative" data-status-menu>
                  <button
                    ref={bulkStatusButtonRef}
                    type="button"
                    onClick={() => {
                      setScheduleTargetId(null);
                      setOpenStatusId((current) => (current === BULK_STATUS_ID ? null : BULK_STATUS_ID));
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-brand/30 bg-white px-4 text-sm font-black text-brand transition hover:border-brand"
                    aria-expanded={openStatusId === BULK_STATUS_ID}
                  >
                    <Send size={15} /> Status <MoreVertical size={15} />
                  </button>
                  {openStatusId === BULK_STATUS_ID && (
                    <>
                      {mounted &&
                        createPortal(
                          <>
                            {bulkMenuPosition && (
                              <div
                                className="admin-menu-surface fixed z-[220] hidden w-72 overflow-y-auto rounded-xl border p-2 shadow-2xl lg:block"
                                style={bulkMenuPosition}
                                data-status-menu
                              >
                                {bulkStatusMenuContent}
                              </div>
                            )}
                            <button
                              type="button"
                              aria-label="Status oynasini yopish"
                              className="admin-status-overlay fixed inset-0 z-[175] lg:hidden"
                              onClick={() => {
                                setOpenStatusId(null);
                                setScheduleTargetId(null);
                              }}
                            />
                            <div
                              className="admin-menu-surface admin-status-sheet fixed inset-x-3 z-[180] overflow-y-auto rounded-xl border p-2 shadow-2xl lg:hidden"
                              data-status-menu
                            >
                              {bulkStatusMenuContent}
                            </div>
                          </>,
                          document.body
                        )}
                    </>
                  )}
                </div>
                <button
                  onClick={() => {
                    onBulkTrash(selected);
                    setSelected([]);
                  }}
                  className="rounded-full bg-red-600 px-4 py-2 text-white"
                >
                  Trashga yuborish
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3">
        {filtered.map((item) => {
          const nextStatuses = ARTICLE_STATUSES.filter((nextStatus) => nextStatus !== item.status);
          const statusMenuContent = scheduleTargetId === item.id ? (
            <div className="p-2">
              <div className="px-1 pb-2 text-xs font-black uppercase tracking-wide text-slate-500">Nashr sanasini belgilang</div>
              <input
                type="datetime-local"
                value={scheduleValue}
                onChange={(event) => setScheduleValue(event.target.value)}
                min={localDateTimeValue(Date.now() + 60_000)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-brand"
              />
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setScheduleTargetId(null)}>
                  Bekor qilish
                </Button>
                <Button size="sm" className="flex-1" disabled={!scheduleValue} onClick={() => confirmSchedule(item.id)}>
                  Rejalashtirish
                </Button>
              </div>
            </div>
          ) : (
            <>
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
            </>
          );
          return (
            <article
              key={item.id}
              className={`group relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand/60 hover:shadow-xl lg:hover:-translate-y-0.5 ${
                openStatusId === item.id ? "z-[140]" : "z-0"
              }`}
            >
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
                    <div className="relative" data-status-menu>
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
                        <>
                          <div className="admin-menu-surface absolute right-0 top-12 z-[160] hidden max-h-[70vh] w-72 overflow-y-auto rounded-xl border p-2 shadow-2xl lg:block">
                            {statusMenuContent}
                          </div>
                          {mounted &&
                            createPortal(
                              <>
                                <button
                                  type="button"
                                  aria-label="Status oynasini yopish"
                                  className="admin-status-overlay fixed inset-0 z-[175] lg:hidden"
                                  onClick={() => {
                                    setOpenStatusId(null);
                                    setScheduleTargetId(null);
                                  }}
                                />
                                <div
                                  className="admin-menu-surface admin-status-sheet fixed inset-x-3 z-[180] overflow-y-auto rounded-xl border p-2 shadow-2xl lg:hidden"
                                  data-status-menu
                                >
                                  {statusMenuContent}
                                </div>
                              </>,
                              document.body
                            )}
                        </>
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
      <Pagination page={page} pages={pages} onChange={onPageChange} />
    </Panel>
  );
}

export async function fetchArticles(options: { trashed: boolean; page: number; search?: string; status?: ArticleStatus | ""; today?: boolean }) {
  const query = new URLSearchParams({ page: String(options.page), limit: "50" });
  if (options.trashed) query.set("trashed", "true");
  if (options.search) query.set("search", options.search);
  if (options.status) query.set("status", options.status);
  if (options.today) query.set("today", "true");
  return adminRequest<{ items: Article[]; total: number; page: number; pages: number }>(`/admin/articles?${query}`);
}
