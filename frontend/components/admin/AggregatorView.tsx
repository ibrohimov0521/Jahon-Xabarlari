"use client";

import { CheckCircle2, Loader2, Plus, PlayCircle, RefreshCcw, Rss, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { Button, ErrorBanner, Panel, SuccessBanner } from "./ui";

type AggregatorStatus = {
  enabled: boolean;
  intervalMinutes: number;
  publishStatus: string;
  openaiConfigured: boolean;
  sources: AggregatorSource[];
};

type AggregatorSource = {
  id: string;
  name: string;
  feedUrl: string;
  enabled: boolean;
};

export function AggregatorView() {
  const [status, setStatus] = useState<AggregatorStatus | null>(null);
  const [limit, setLimit] = useState("40");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sourceForm, setSourceForm] = useState({ name: "", feedUrl: "" });
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const data = await adminRequest<AggregatorStatus>("/admin/aggregator/status");
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Holatni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function runNow() {
    setRunning(true);
    setError("");
    setMessage("");
    try {
      const result = await adminRequest<{ ok: boolean; published: number; message: string }>("/admin/aggregator/run", {
        method: "POST",
        body: JSON.stringify({ limit: Number(limit) || undefined })
      });
      if (result.ok) {
        setMessage(result.message);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ishga tushirib bo'lmadi");
    } finally {
      setRunning(false);
    }
  }

  async function toggleSource(source: AggregatorSource) {
    setError("");
    setTogglingId(source.id);
    // Optimistic update -- flip the row immediately instead of waiting on a full status
    // refetch, and roll back only that row if the request fails.
    setStatus((current) => (current ? { ...current, sources: current.sources.map((item) => (item.id === source.id ? { ...item, enabled: !item.enabled } : item)) } : current));
    try {
      await adminRequest(`/admin/aggregator/sources/${source.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !source.enabled }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manba holatini o'zgartirib bo'lmadi");
      setStatus((current) => (current ? { ...current, sources: current.sources.map((item) => (item.id === source.id ? { ...item, enabled: source.enabled } : item)) } : current));
    } finally {
      setTogglingId(null);
    }
  }

  async function addSource() {
    setError("");
    setMessage("");
    setAdding(true);
    try {
      const created = await adminRequest<AggregatorSource>("/admin/aggregator/sources", { method: "POST", body: JSON.stringify(sourceForm) });
      setStatus((current) => (current ? { ...current, sources: [created, ...current.sources] } : current));
      setSourceForm({ name: "", feedUrl: "" });
      setMessage("Yangi manba qo'shildi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manba qo'shib bo'lmadi");
    } finally {
      setAdding(false);
    }
  }

  async function confirmDelete(id: string) {
    setError("");
    setDeletingId(id);
    try {
      await adminRequest(`/admin/aggregator/sources/${id}`, { method: "DELETE" });
      setStatus((current) => (current ? { ...current, sources: current.sources.filter((item) => item.id !== id) } : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manbani o'chirib bo'lmadi");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <Panel
      title="Yangiliklar agregatori"
      actions={
        <Button variant="secondary" size="sm" onClick={loadStatus} disabled={loading} icon={<RefreshCcw size={16} className={loading ? "animate-spin" : ""} />}>
          Yangilash
        </Button>
      }
    >
      <ErrorBanner message={error} />
      <SuccessBanner message={message} />
      {loading && !status && <p className="text-sm text-slate-500">Yuklanmoqda...</p>}
      {status && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 p-4 text-sm">
            <p>
              <strong>Avtomatik rejim:</strong> {status.enabled ? `Yoqilgan (har ${status.intervalMinutes} daqiqada)` : "O'chirilgan"}
            </p>
            <p className="mt-1">
              <strong>Nashr holati:</strong> {status.publishStatus}
            </p>
            <p className="mt-1">
              <strong>OpenAI kaliti:</strong> {status.openaiConfigured ? "Sozlangan ✅" : "Sozlanmagan ❌"}
            </p>
            <p className="mt-1">
              <strong>Manbalar:</strong> {status.sources.length} ta, yoqilgan: {status.sources.filter((source) => source.enabled).length} ta
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-4">
            <label className="text-sm font-bold">
              Bir martalik ishga tushirish (limit)
              <input
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                type="number"
                min={1}
                max={100}
              />
            </label>
            <Button
              onClick={runNow}
              disabled={running || !status.openaiConfigured}
              className="mt-3 w-full"
              icon={running ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={18} />}
            >
              {running ? "Ishga tushirilmoqda..." : "Hozir ishga tushirish"}
            </Button>
            {!status.openaiConfigured && <p className="mt-2 text-xs text-red-600">OPENAI_API_KEY sozlanmagani uchun ishga tushirib bo'lmaydi.</p>}
          </div>
          <div className="rounded-md border border-slate-200 p-4 sm:col-span-2">
            <h3 className="text-lg font-black">Manbalarni boshqarish</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-[220px_1fr_auto]">
              <input
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand"
                value={sourceForm.name}
                onChange={(event) => setSourceForm({ ...sourceForm, name: event.target.value })}
                placeholder="Sayt nomi"
              />
              <input
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand"
                value={sourceForm.feedUrl}
                onChange={(event) => setSourceForm({ ...sourceForm, feedUrl: event.target.value })}
                placeholder="RSS URL"
              />
              <Button
                onClick={addSource}
                disabled={!sourceForm.name || !sourceForm.feedUrl || adding}
                icon={adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              >
                Qo'shish
              </Button>
            </div>
            <div className="mt-4 grid gap-2">
              {status.sources.map((source) => {
                const isToggling = togglingId === source.id;
                const isDeleting = deletingId === source.id;
                const isConfirming = confirmDeleteId === source.id;
                return (
                  <div
                    key={source.id}
                    className="grid items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md md:grid-cols-[1fr_auto_auto]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${source.enabled ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-400"}`}>
                        <Rss size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-black">{source.name}</p>
                        <p className="truncate text-sm text-slate-500">{source.feedUrl}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSource(source)}
                      disabled={isToggling}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-black transition disabled:opacity-60 ${
                        source.enabled ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {isToggling ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : source.enabled ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <XCircle size={14} />
                      )}
                      {source.enabled ? "Yoqilgan" : "O'chirilgan"}
                    </button>
                    {isConfirming ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => confirmDelete(source.id)}
                          disabled={isDeleting}
                          icon={isDeleting ? <Loader2 size={15} className="animate-spin" /> : undefined}
                        >
                          Tasdiqlash
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={isDeleting}>
                          Bekor
                        </Button>
                      </div>
                    ) : (
                      <Button variant="danger" size="sm" onClick={() => setConfirmDeleteId(source.id)} icon={<Trash2 size={15} />}>
                        O'chirish
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
