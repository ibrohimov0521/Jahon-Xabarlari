"use client";

import { ExternalLink, EyeOff, MessageCircle, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatArticleDateTime } from "../../lib/format";
import { COMMENT_STATUSES, type CommentItem, type CommentStatus, type CommentSummary } from "./types";
import { Badge, Button, ConfirmButton, Empty, Pagination, Panel, SearchInput, SelectFilter } from "./ui";

const statusTone: Record<CommentStatus, "green" | "amber" | "red"> = {
  APPROVED: "green",
  PENDING: "amber",
  DELETED: "red"
};

const statusLabel: Record<CommentStatus, string> = {
  APPROVED: "Ko'rinmoqda",
  PENDING: "Eski navbat",
  DELETED: "Yashirilgan"
};

export function CommentsView({
  comments,
  summary,
  onStatus,
  onDelete,
  onBulkStatus,
  onBulkDelete,
  page,
  pages,
  onPageChange,
  onFiltersChange
}: {
  comments: CommentItem[];
  summary: CommentSummary;
  onStatus: (id: string, status: CommentStatus) => void;
  onDelete: (id: string) => void;
  onBulkStatus: (ids: string[], status: "APPROVED" | "DELETED") => void;
  onBulkDelete: (ids: string[]) => void;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  onFiltersChange: (search: string, status: CommentStatus | "") => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CommentStatus | "">("");
  const [selected, setSelected] = useState<string[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  useEffect(() => {
    const visible = new Set(comments.map((item) => item.id));
    setSelected((current) => current.filter((id) => visible.has(id)));
  }, [comments]);

  function changeSearch(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => onFiltersChange(value, status), 300);
  }

  function changeStatus(value: CommentStatus | "") {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setStatus(value);
    setSelected([]);
    onFiltersChange(search, value);
  }

  const allSelected = comments.length > 0 && comments.every((item) => selected.includes(item.id));
  const selectedItems = comments.filter((item) => selected.includes(item.id));
  const canPermanentlyDelete = selectedItems.length > 0 && selectedItems.every((item) => item.status === "DELETED");

  function runBulk(action: () => void) {
    action();
    setSelected([]);
  }

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Jami izoh", value: summary.total, tone: "text-cyan-400" },
          { label: "Saytda ko'rinmoqda", value: summary.approved, tone: "text-emerald-400" },
          { label: "Yashirilgan", value: summary.hidden, tone: "text-red-400" }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-cyan-300/20 bg-white/5 p-4 shadow-sm backdrop-blur-xl">
            <MessageCircle size={18} className={item.tone} />
            <strong className="mt-3 block text-2xl font-black">{item.value.toLocaleString("uz-UZ")}</strong>
            <span className="mt-1 block text-xs font-bold text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>

      <Panel
        title="Izohlar"
        actions={<Badge tone="green">Avtomatik nashr yoqilgan</Badge>}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={changeSearch} placeholder="Ism, izoh yoki maqola..." />
            <SelectFilter value={status} onChange={changeStatus} options={COMMENT_STATUSES} allLabel="Barcha izohlar" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-black">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : comments.map((item) => item.id))} className="size-4 accent-blue-600" />
            Sahifadagilarni tanlash
          </label>
        </div>

        {selected.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-brand/20 bg-blue-50/70 p-3">
            <strong className="mr-auto text-sm text-brand">{selected.length} ta izoh tanlandi</strong>
            <Button size="sm" variant="secondary" icon={<EyeOff size={15} />} onClick={() => runBulk(() => onBulkStatus(selected, "DELETED"))}>Yashirish</Button>
            <Button size="sm" variant="secondary" icon={<RotateCcw size={15} />} onClick={() => runBulk(() => onBulkStatus(selected, "APPROVED"))}>Tiklash</Button>
            {canPermanentlyDelete && <ConfirmButton label="Butunlay o'chirish" confirmLabel="Ha, o'chirish" icon={<Trash2 size={14} />} onConfirm={() => runBulk(() => onBulkDelete(selected))} />}
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {comments.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-white/5 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} className="mt-1 size-4 shrink-0 accent-blue-600" />
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-black text-brand">{item.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><strong className="block truncate">{item.name}</strong><time className="text-xs font-semibold text-slate-400">{formatArticleDateTime(item.createdAt)}</time></div>
                    <Badge tone={statusTone[item.status]}>{statusLabel[item.status]}</Badge>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.body}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                    {item.article ? (
                      <a href={`/articles/${item.article.slug}`} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-xs font-bold text-brand hover:underline">
                        <span className="truncate">{item.article.title}</span><ExternalLink size={13} className="shrink-0" />
                      </a>
                    ) : <span className="text-xs text-slate-400">Maqola topilmadi</span>}
                    <div className="flex items-center gap-2">
                      {item.status === "DELETED" ? (
                        <>
                          <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={() => onStatus(item.id, "APPROVED")}>Tiklash</Button>
                          <ConfirmButton label={<Trash2 size={14} />} confirmLabel="Butunlay o'chirish" onConfirm={() => onDelete(item.id)} />
                        </>
                      ) : (
                        <ConfirmButton label="Yashirish" confirmLabel="Ha, yashirish" icon={<EyeOff size={14} />} onConfirm={() => onStatus(item.id, "DELETED")} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {!comments.length && <div className="lg:col-span-2"><Empty text="Izoh topilmadi" /></div>}
        </div>
        <Pagination page={page} pages={pages} onChange={onPageChange} />
      </Panel>
    </div>
  );
}
