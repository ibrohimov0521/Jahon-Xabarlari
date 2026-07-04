"use client";

import { Edit3, Eye, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { ARTICLE_STATUSES, type Article, type ArticleStatus } from "./types";
import { Badge, ConfirmButton, Empty, Panel, SearchInput, SelectFilter } from "./ui";

const TRANSLATION_TONE: Record<string, "green" | "amber" | "red"> = { READY: "green", PENDING: "amber", FAILED: "red" };

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

  useEffect(() => {
    setStatus(initialStatus);
    setSelected([]);
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

  return (
    <Panel
      title={trashed ? "Trash" : "Yangiliklar jadvali"}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {onlyToday && <Badge tone="green">Bugun qo'shilganlar</Badge>}
          <SearchInput value={search} onChange={setSearch} placeholder="Sarlavha bo'yicha qidirish..." />
          {!trashed && <SelectFilter value={status} onChange={setStatus} options={ARTICLE_STATUSES} allLabel="Barcha statuslar" />}
          <button
            onClick={() => {
              onTrashedChange(!trashed);
              setSelected([]);
            }}
            className={`rounded-md border px-3 py-2 text-sm font-bold ${trashed ? "border-brand text-brand" : "border-slate-200"}`}
          >
            {trashed ? "Faol maqolalar" : "Trash"}
          </button>
        </div>
      }
    >
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-blue-50 px-4 py-2 text-sm font-bold text-brand">
          {selected.length} ta tanlandi
          {trashed ? (
            <button
              onClick={() => {
                onBulkRestore(selected);
                setSelected([]);
              }}
              className="rounded-md bg-brand px-3 py-1.5 text-white"
            >
              Tiklash
            </button>
          ) : (
            <button
              onClick={() => {
                onBulkTrash(selected);
                setSelected([]);
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-white"
            >
              Trashga yuborish
            </button>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-8 p-3">
                <input type="checkbox" checked={selected.length > 0 && selected.length === filtered.length} onChange={toggleSelectAll} />
              </th>
              <th className="p-3">Sarlavha</th>
              <th>Kategoriya</th>
              <th>Status</th>
              <th>Ko'rish</th>
              <th>Tarjima</th>
              <th>Belgilar</th>
              <th>Amal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr className="border-t border-slate-200" key={item.id}>
                <td className="p-3">
                  <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                </td>
                <td className="p-3 font-bold">{item.title}</td>
                <td>{item.category?.name ?? "-"}</td>
                <td>
                  <Badge>{item.status}</Badge>
                </td>
                <td>{item.viewsCount}</td>
                <td>
                  <div className="flex gap-1">
                    {["ru", "en"].map((lang) => {
                      const info = item.translations?.find((t) => t.lang === lang);
                      if (!info) return null;
                      return (
                        <button
                          key={lang}
                          disabled={info.status !== "FAILED"}
                          onClick={() => onRegenerateTranslation(item.id, lang)}
                          title={`${lang.toUpperCase()}: ${info.status}${info.status === "FAILED" ? " — qayta urinish uchun bosing" : ""}`}
                        >
                          <Badge tone={TRANSLATION_TONE[info.status] ?? "slate"}>{lang.toUpperCase()}</Badge>
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td className="text-slate-500">
                  {[item.isBreaking && "Breaking", item.isFeatured && "Featured", item.isEditorChoice && "Editor"].filter(Boolean).join(", ") || "-"}
                  {item.sourceName && (
                    <div className="mt-1">
                      <Badge tone="slate">🤖 {item.sourceName}</Badge>
                    </div>
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onEdit(item.id)} className="rounded-md border border-slate-200 p-1.5 hover:border-brand" title="Tahrirlash">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => onPreview(item)} className="rounded-md border border-slate-200 p-1.5 hover:border-brand" title="Ko'rish">
                      <Eye size={14} />
                    </button>
                    {!trashed &&
                      ARTICLE_STATUSES.filter((s) => s !== "SCHEDULED").map((s) => (
                        <button key={s} onClick={() => onStatus(item.id, s)} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold hover:border-brand">
                          {s}
                        </button>
                      ))}
                    {trashed ? (
                      <>
                        <button onClick={() => onRestore(item.id)} className="rounded-md bg-brand p-1.5 text-white" title="Tiklash">
                          <RotateCcw size={14} />
                        </button>
                        <ConfirmButton label={<Trash2 size={14} />} confirmLabel="Butunlay o'chirish" onConfirm={() => onPermanentDelete(item.id)} />
                      </>
                    ) : (
                      <ConfirmButton label={<Trash2 size={14} />} confirmLabel="Trash" onConfirm={() => onTrash(item.id)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <Empty text={trashed ? "Trash bo'sh" : "Bazadagi yangiliklar bo'sh. Yangi maqola qo'shishingiz mumkin."} />}
      </div>
    </Panel>
  );
}

export async function fetchArticles(trashed: boolean) {
  return adminRequest<{ items: Article[] }>(`/admin/articles${trashed ? "?trashed=true" : ""}`);
}
