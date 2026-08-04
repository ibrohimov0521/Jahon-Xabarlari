"use client";

import { CheckCircle2, ExternalLink, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { Badge, Button, Empty, ErrorBanner, LoadingBlock, Pagination, Panel, SelectFilter } from "./ui";

type ReportStatus = "PENDING" | "RESOLVED" | "DISMISSED";
type Report = {
  id: string;
  reason: string;
  details: string;
  email?: string | null;
  status: ReportStatus;
  createdAt: string;
  article: { id: string; title: string; slug: string };
};

const reasonNames: Record<string, string> = {
  FACT_ERROR: "Fakt xatosi", TYPO: "Imlo xatosi", COPYRIGHT: "Mualliflik huquqi", INAPPROPRIATE: "Nomaqbul material", OTHER: "Boshqa"
};

export function ReportsView() {
  const [items, setItems] = useState<Report[]>([]);
  const [status, setStatus] = useState<ReportStatus | "">("PENDING");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  async function load() {
    setLoading(true); setError("");
    const query = new URLSearchParams({ page: String(page), limit: "30" });
    if (status) query.set("status", status);
    try {
      const data = await adminRequest<{ items: Report[]; pages: number }>(`/admin/article-reports?${query}`);
      setItems(data.items); setPages(Math.max(data.pages, 1));
      setSelected((current) => current.filter((id) => data.items.some((item) => item.id === id)));
    } catch (err) { setError(err instanceof Error ? err.message : "Xabarlar yuklanmadi"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [page, status]);

  async function changeStatus(id: string, next: ReportStatus) {
    try {
      await adminRequest(`/admin/article-reports/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) { setError(err instanceof Error ? err.message : "Status o'zgarmadi"); }
  }

  async function bulkStatus(next: ReportStatus) {
    try {
      await adminRequest("/admin/article-reports/bulk-status", { method: "POST", body: JSON.stringify({ ids: selected, status: next }) });
      setSelected([]);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Statuslar o'zgarmadi"); }
  }

  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));

  return (
    <Panel title="Maqola bo'yicha xabarlar" actions={
      <SelectFilter value={status} onChange={(value) => { setStatus(value); setPage(1); }} allLabel="Barcha statuslar" options={[
        { value: "PENDING", label: "Kutilmoqda" }, { value: "RESOLVED", label: "Hal qilindi" }, { value: "DISMISSED", label: "Rad etildi" }
      ]} />
    }>
      <ErrorBanner message={error} />
      {loading && <LoadingBlock />}
      {!loading && items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/5 p-3">
          <label className="mr-auto inline-flex items-center gap-2 text-sm font-black">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : items.map((item) => item.id))} className="size-4 accent-blue-600" />
            Sahifadagilarni tanlash
          </label>
          {selected.length > 0 && <strong className="text-sm text-brand">{selected.length} ta tanlandi</strong>}
          {selected.length > 0 && <Button size="sm" icon={<CheckCircle2 size={14} />} onClick={() => bulkStatus("RESOLVED")}>Hal qilindi</Button>}
          {selected.length > 0 && <Button size="sm" variant="secondary" icon={<XCircle size={14} />} onClick={() => bulkStatus("DISMISSED")}>Rad etish</Button>}
          {selected.length > 0 && <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={() => bulkStatus("PENDING")}>Qayta ochish</Button>}
        </div>
      )}
      {!loading && !items.length && <Empty text="Bu statusda xabar yo'q" />}
      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} className="mt-1 size-4 shrink-0 accent-blue-600" aria-label="Xato xabarini tanlash" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="amber">{reasonNames[item.reason] ?? item.reason}</Badge><span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("uz-UZ")}</span></div>
                <Link
                  href={`/articles/${item.article.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 font-black hover:text-brand"
                >
                  {item.article.title}<ExternalLink size={14} />
                </Link>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{item.details}</p>
                {item.email && <a className="mt-2 block text-xs font-bold text-brand" href={`mailto:${item.email}`}>{item.email}</a>}
              </div>
              {item.status === "PENDING" && <div className="flex gap-2"><Button size="sm" onClick={() => changeStatus(item.id, "RESOLVED")} icon={<CheckCircle2 size={15} />}>Hal qilindi</Button><Button size="sm" variant="secondary" onClick={() => changeStatus(item.id, "DISMISSED")} icon={<XCircle size={15} />}>Rad etish</Button></div>}
            </div>
          </article>
        ))}
      </div>
      <Pagination page={page} pages={pages} onChange={setPage} />
    </Panel>
  );
}
