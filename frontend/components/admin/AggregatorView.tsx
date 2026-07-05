"use client";

import { Plus, PlayCircle, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { ErrorBanner, Panel, SuccessBanner } from "./ui";

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
  const [limit, setLimit] = useState("300");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sourceForm, setSourceForm] = useState({ name: "", feedUrl: "" });

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
    try {
      await adminRequest(`/admin/aggregator/sources/${source.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !source.enabled }) });
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manba holatini o'zgartirib bo'lmadi");
    }
  }

  async function addSource() {
    setError("");
    setMessage("");
    try {
      await adminRequest("/admin/aggregator/sources", { method: "POST", body: JSON.stringify(sourceForm) });
      setSourceForm({ name: "", feedUrl: "" });
      setMessage("Yangi manba qo'shildi");
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manba qo'shib bo'lmadi");
    }
  }

  async function deleteSource(id: string) {
    if (!confirm("Bu manbani o'chirasizmi?")) return;
    setError("");
    try {
      await adminRequest(`/admin/aggregator/sources/${id}`, { method: "DELETE" });
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manbani o'chirib bo'lmadi");
    }
  }

  return (
    <Panel
      title="Yangiliklar agregatori"
      actions={
        <button onClick={loadStatus} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold hover:border-brand">
          <RefreshCcw size={16} /> Yangilash
        </button>
      }
    >
      <ErrorBanner message={error} />
      <SuccessBanner message={message} />
      {loading && <p className="text-sm text-slate-500">Yuklanmoqda...</p>}
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
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                type="number"
                min={1}
                max={1000}
              />
            </label>
            <button
              onClick={runNow}
              disabled={running || !status.openaiConfigured}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 font-black text-white disabled:opacity-60"
            >
              <PlayCircle size={18} /> {running ? "Ishga tushirilmoqda..." : "Hozir ishga tushirish"}
            </button>
            {!status.openaiConfigured && <p className="mt-2 text-xs text-red-600">OPENAI_API_KEY sozlanmagani uchun ishga tushirib bo'lmaydi.</p>}
          </div>
          <div className="rounded-md border border-slate-200 p-4 sm:col-span-2">
            <h3 className="text-lg font-black">Manbalarni boshqarish</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-[220px_1fr_auto]">
              <input
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                value={sourceForm.name}
                onChange={(event) => setSourceForm({ ...sourceForm, name: event.target.value })}
                placeholder="Sayt nomi"
              />
              <input
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                value={sourceForm.feedUrl}
                onChange={(event) => setSourceForm({ ...sourceForm, feedUrl: event.target.value })}
                placeholder="RSS URL"
              />
              <button onClick={addSource} disabled={!sourceForm.name || !sourceForm.feedUrl} className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 font-black text-white disabled:opacity-50">
                <Plus size={16} /> Qo'shish
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {status.sources.map((source) => (
                <div key={source.id} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="font-black">{source.name}</p>
                    <p className="truncate text-sm text-slate-500">{source.feedUrl}</p>
                  </div>
                  <button
                    onClick={() => toggleSource(source)}
                    className={`rounded-full px-4 py-2 text-sm font-black ${source.enabled ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {source.enabled ? "Yoqilgan" : "O'chirilgan"}
                  </button>
                  <button onClick={() => deleteSource(source.id)} className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-black text-white">
                    <Trash2 size={15} /> O'chirish
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
