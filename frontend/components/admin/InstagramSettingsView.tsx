"use client";

import { CheckCircle2, CircleAlert, ExternalLink, Image, Instagram, Loader2, RefreshCcw, Send, ShieldCheck, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { Button, ErrorBanner, Panel, SuccessBanner } from "./ui";

type InstagramStatus = {
  enabled: boolean;
  ready: boolean;
  graphApiVersion: string;
  tokenConfigured: boolean;
  userIdConfigured: boolean;
  accountHint: string | null;
  publicMediaReady: boolean;
  mediaRendererReady: boolean;
  posts: { sent: number; failed: number; queued: number };
  latestFailure: { title: string; message: string; at: string } | null;
  configurationMessage: string;
};

type ConnectionResult = { ok: boolean; message: string; username?: string; accountType?: string };

function CheckItem({ ok, label, value }: { ok: boolean; label: string; value?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-slate-950/30">
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${ok ? "bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"}`}>
        {ok ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
      </span>
      <div className="min-w-0">
        <p className="font-black">{label}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{value ?? (ok ? "Tayyor" : "Sozlash kerak")}</p>
      </div>
    </div>
  );
}

export function InstagramSettingsView() {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      setStatus(await adminRequest<InstagramStatus>("/admin/instagram/status"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Instagram holatini yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function testConnection() {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const result = await adminRequest<ConnectionResult>("/admin/instagram/test-connection", { method: "POST" });
      const account = result.username ? ` @${result.username}` : "";
      const type = result.accountType ? ` (${result.accountType})` : "";
      setMessage(`${result.message}${account}${type}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Instagram ulanishi tekshirilmadi");
      await load();
    } finally {
      setTesting(false);
    }
  }

  return (
    <Panel
      title="Instagram sozlamalari"
      actions={
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading} icon={<RefreshCcw size={16} className={loading ? "animate-spin" : ""} />}>
          Yangilash
        </Button>
      }
    >
      <ErrorBanner message={error} />
      <SuccessBanner message={message} />
      {loading && !status && <p className="text-sm text-slate-500">Instagram holati tekshirilmoqda...</p>}
      {status && (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-4">
            <div className={`rounded-xl border p-4 ${status.ready ? "border-green-300 bg-green-50/80 dark:border-green-400/30 dark:bg-green-400/10" : "border-amber-300 bg-amber-50/80 dark:border-amber-400/30 dark:bg-amber-400/10"}`}>
              <div className="flex gap-3">
                <span className={`grid size-11 shrink-0 place-items-center rounded-lg ${status.ready ? "bg-green-600 text-white" : "bg-amber-500 text-white"}`}>
                  <Instagram size={21} />
                </span>
                <div>
                  <p className="font-black">{status.ready ? "Instagram nashr tizimi tayyor" : "Instagram sozlanishi kerak"}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{status.configurationMessage}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => void testConnection()} disabled={testing || !status.ready} icon={testing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}>
                  {testing ? "Tekshirilmoqda..." : "Ulanishni tekshirish"}
                </Button>
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-ink transition hover:border-brand hover:text-brand dark:border-white/15 dark:bg-slate-950/30 dark:text-white"
                >
                  Meta Developer <ExternalLink size={15} />
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <CheckItem ok={status.enabled} label="Avtomatik yuborish" value={status.enabled ? "Yoqilgan" : "Railway'da INSTAGRAM_POSTING_ENABLED=true qiling"} />
              <CheckItem ok={status.tokenConfigured} label="Access token" value={status.tokenConfigured ? "Maxfiy token saqlangan" : "Railway'da token kiritilmagan"} />
              <CheckItem ok={status.userIdConfigured} label="Instagram akkaunt" value={status.accountHint ? `ID ${status.accountHint}` : "Instagram User ID kerak"} />
              <CheckItem ok={status.publicMediaReady} label="Public media URL" value={status.publicMediaReady ? "Meta rasm/video olishi mumkin" : "HTTPS BACKEND_PUBLIC_URL kerak"} />
              <CheckItem ok={status.mediaRendererReady} label="Reel media-renderer" value={status.mediaRendererReady ? "Video Reels uchun tayyor" : "MEDIA_RENDERER sozlanmagan"} />
              <CheckItem ok={status.ready} label="Graph API" value={status.graphApiVersion} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-white/80 p-3 text-center dark:border-white/10 dark:bg-slate-950/30"><Send className="mx-auto text-brand" size={19} /><p className="mt-2 text-2xl font-black">{status.posts.sent}</p><p className="text-xs font-bold text-slate-500">Yuborilgan</p></div>
              <div className="rounded-lg border border-slate-200 bg-white/80 p-3 text-center dark:border-white/10 dark:bg-slate-950/30"><Image className="mx-auto text-brand" size={19} /><p className="mt-2 text-2xl font-black">{status.posts.queued}</p><p className="text-xs font-bold text-slate-500">Navbatda</p></div>
              <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-center dark:border-red-400/20 dark:bg-red-400/10"><CircleAlert className="mx-auto text-red-600" size={19} /><p className="mt-2 text-2xl font-black">{status.posts.failed}</p><p className="text-xs font-bold text-red-600">Xato</p></div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-950/30">
              <div className="flex items-center gap-2"><Video size={18} className="text-brand" /><h3 className="font-black">Nashr tartibi</h3></div>
              <ul className="mt-3 space-y-2 text-sm font-semibold leading-5 text-slate-600 dark:text-slate-300">
                <li>Rasmli maqola: sarlavhali muqova va asl rasm bilan Carousel Post.</li>
                <li>Videoli maqola: watermarkli Reel va asosiy tasmada ulashish.</li>
                <li>Maqola editorida Instagram Post yoki Reel tanlanadi; xato bo'lsa Yangiliklar bo'limidan qayta yuboriladi.</li>
              </ul>
            </div>
            {status.latestFailure && (
              <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm dark:border-red-400/20 dark:bg-red-400/10">
                <p className="font-black text-red-700 dark:text-red-300">So'nggi yuborish xatosi</p>
                <p className="mt-2 font-bold">{status.latestFailure.title}</p>
                <p className="mt-1 break-words text-slate-600 dark:text-slate-300">{status.latestFailure.message}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
