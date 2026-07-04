"use client";

import { PlayCircle, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { ErrorBanner, Panel, SuccessBanner } from "./ui";

type AggregatorStatus = {
  enabled: boolean;
  intervalMinutes: number;
  publishStatus: string;
  openaiConfigured: boolean;
  sources: string[];
};

export function AggregatorView() {
  const [status, setStatus] = useState<AggregatorStatus | null>(null);
  const [limit, setLimit] = useState("300");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
      await adminRequest("/admin/aggregator/run", { method: "POST", body: JSON.stringify({ limit: Number(limit) || undefined }) });
      setMessage(
        `Aggregator ishga tushirildi (limit: ${limit}). Bu fonda bir necha daqiqa davom etishi mumkin -- yangi maqolalarni "Yangiliklar" bo'limida ko'rasiz.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ishga tushirib bo'lmadi");
    } finally {
      setRunning(false);
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
              <strong>Manbalar:</strong> {status.sources.length} ta ({status.sources.join(", ")})
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
        </div>
      )}
    </Panel>
  );
}
