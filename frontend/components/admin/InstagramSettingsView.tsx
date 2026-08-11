"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock3, ExternalLink, Eye, Globe2, Instagram, Loader2, PauseCircle, PlayCircle, RefreshCcw, Send, ShieldCheck, Trash2, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { useScrollLock } from "../../lib/use-scroll-lock";
import { Button, ErrorBanner, Panel, SuccessBanner } from "./ui";

type InstagramStatus = {
  enabled: boolean;
  autoPublishEnabled: boolean;
  ready: boolean;
  apiMode: "instagram_login" | "facebook_login";
  apiEndpoint: string;
  graphApiVersion: string;
  tokenConfigured: boolean;
  userIdConfigured: boolean;
  accountHint: string | null;
  publicMediaReady: boolean;
  mediaRendererReady: boolean;
  posts: { sent: number; failed: number; queued: number; recoverable: number };
  latestFailure: { title: string; message: string; at: string } | null;
  configurationMessage: string;
};

type ConnectionResult = { ok: boolean; message: string; username?: string; accountType?: string };
type DeliveryState = "sent" | "queued" | "failed";
type InstagramDelivery = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  mainImage: string | null;
  previewUrl: string | null;
  instagramFormat: "POST" | "REEL" | null;
  instagramSentAt: string | null;
  instagramUrl: string | null;
  instagramError: string | null;
  updatedAt: string;
  category: { name: string; slug: string };
};
type DeliveryResponse = { state: DeliveryState; items: InstagramDelivery[]; total: number; page: number; pages: number };
type InstagramSource = { id: string; name: string; feedUrl: string; instagramEnabled: boolean };
type InstagramSourcesResponse = { items: InstagramSource[] };

const DELIVERY_META: Record<DeliveryState, { label: string; empty: string; icon: typeof Send; tone: string }> = {
  sent: { label: "Yuborilgan", empty: "Hali Instagramga yuborilgan maqola yo'q.", icon: Send, tone: "text-brand" },
  queued: { label: "Navbatda", empty: "Hozir Instagram navbatida maqola yo'q.", icon: Clock3, tone: "text-amber-600 dark:text-amber-300" },
  failed: { label: "Xato", empty: "Instagram yuborish xatosi yo'q.", icon: CircleAlert, tone: "text-red-600 dark:text-red-300" }
};
const INSTAGRAM_PREVIEW_HISTORY_KEY = "__bestTeamInstagramPreview";

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
  const [savingAutoPublish, setSavingAutoPublish] = useState(false);
  const [sources, setSources] = useState<InstagramSource[]>([]);
  const [sourceSavingId, setSourceSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryState, setDeliveryState] = useState<DeliveryState | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryResponse | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<InstagramDelivery | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const connectionConfigured = Boolean(
    status?.enabled && status.tokenConfigured && status.userIdConfigured && status.publicMediaReady
  );

  useScrollLock(Boolean(selectedDelivery));

  async function load() {
    setLoading(true);
    try {
      const [statusResult, sourceResult] = await Promise.all([
        adminRequest<InstagramStatus>("/admin/instagram/status"),
        adminRequest<InstagramSourcesResponse>("/admin/instagram/sources")
      ]);
      setStatus(statusResult);
      setSources(sourceResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Instagram holatini yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const closeOnBack = () => setSelectedDelivery(null);
    window.addEventListener("popstate", closeOnBack);
    return () => window.removeEventListener("popstate", closeOnBack);
  }, []);

  function openDeliveryPreview(delivery: InstagramDelivery) {
    window.history.pushState(
      { ...(window.history.state ?? {}), [INSTAGRAM_PREVIEW_HISTORY_KEY]: true },
      "",
      window.location.href
    );
    setSelectedDelivery(delivery);
  }

  function clearDeliveryPreview() {
    const state = { ...((window.history.state ?? {}) as Record<string, unknown>) };
    if (state[INSTAGRAM_PREVIEW_HISTORY_KEY]) {
      delete state[INSTAGRAM_PREVIEW_HISTORY_KEY];
      window.history.replaceState(state, "", window.location.href);
    }
    setSelectedDelivery(null);
  }

  function closeDeliveryPreview() {
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    if (state[INSTAGRAM_PREVIEW_HISTORY_KEY]) window.history.back();
    else setSelectedDelivery(null);
  }

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

  async function toggleAutoPublish() {
    if (!status || !status.enabled) return;
    const nextValue = !status.autoPublishEnabled;
    setSavingAutoPublish(true);
    setError("");
    setMessage("");
    try {
      const result = await adminRequest<{ autoPublishEnabled: boolean; message: string }>("/admin/instagram/settings", {
        method: "PATCH",
        body: JSON.stringify({ autoPublishEnabled: nextValue })
      });
      setStatus((current) => current ? { ...current, autoPublishEnabled: result.autoPublishEnabled } : current);
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Instagram avtomatik yuborish sozlamasi saqlanmadi");
    } finally {
      setSavingAutoPublish(false);
    }
  }

  async function toggleSource(source: InstagramSource) {
    setSourceSavingId(source.id);
    setError("");
    setMessage("");
    try {
      const result = await adminRequest<{ source: InstagramSource; message: string }>(`/admin/instagram/sources/${source.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !source.instagramEnabled })
      });
      setSources((current) => current.map((item) => item.id === result.source.id ? result.source : item));
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Instagram manba sozlamasi saqlanmadi");
    } finally {
      setSourceSavingId(null);
    }
  }

  async function loadDeliveries(state: DeliveryState, page = 1) {
    setDeliveryState(state);
    setSelectedIds(new Set());
    setDeliveryLoading(true);
    setError("");
    try {
      setDeliveries(await adminRequest<DeliveryResponse>(`/admin/instagram/deliveries?state=${state}&page=${page}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Instagram xabarlari yuklanmadi");
    } finally {
      setDeliveryLoading(false);
    }
  }

  function toggleDelivery(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCurrentPage() {
    const pageIds = deliveries?.items.map((item) => item.id) ?? [];
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(pageIds));
  }

  async function runBulkAction(action: "prioritize" | "cancel") {
    const ids = [...selectedIds];
    if (!ids.length || !deliveryState) return;
    if (action === "cancel" && !window.confirm(`${ids.length} ta post Instagram navbatidan olib tashlansinmi? Maqolalar saytda qoladi.`)) return;
    setDeliveryLoading(true);
    setError("");
    try {
      const result = await adminRequest<{ message: string }>("/admin/instagram/deliveries/bulk", {
        method: "POST",
        body: JSON.stringify({ ids, action })
      });
      setMessage(result.message);
      setSelectedIds(new Set());
      const nextPage = deliveries?.page ?? 1;
      setDeliveries(await adminRequest<DeliveryResponse>(`/admin/instagram/deliveries?state=${deliveryState}&page=${nextPage}`));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tanlangan postlar uchun amal bajarilmadi");
    } finally {
      setDeliveryLoading(false);
    }
  }

  async function retryDelivery(articleId: string) {
    setDeliveryLoading(true);
    setError("");
    try {
      await adminRequest(`/admin/articles/${articleId}/instagram/retry`, { method: "POST" });
      setMessage("Maqola Instagram navbatiga qayta yuborildi");
      clearDeliveryPreview();
      setDeliveryState("queued");
      const queued = await adminRequest<DeliveryResponse>("/admin/instagram/deliveries?state=queued&page=1");
      setDeliveries(queued);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Instagramga qayta yuborib bo'lmadi");
    } finally {
      setDeliveryLoading(false);
    }
  }

  async function cancelDelivery(articleId: string) {
    if (!window.confirm("Bu maqola saytda qoladi. Faqat Instagramga yuborish navbatidan chiqarilsinmi?")) return;
    setDeliveryLoading(true);
    setError("");
    try {
      const result = await adminRequest<{ message: string }>(`/admin/instagram/deliveries/${articleId}/cancel`, { method: "POST" });
      setMessage(result.message);
      clearDeliveryPreview();
      if (deliveryState) await loadDeliveries(deliveryState, deliveries?.page ?? 1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Instagram navbatidan olib tashlab bo'lmadi");
    } finally {
      setDeliveryLoading(false);
    }
  }

  async function repairQueue() {
    setDeliveryLoading(true);
    setError("");
    try {
      const result = await adminRequest<{ message: string }>("/admin/instagram/queue/repair", { method: "POST" });
      setMessage(result.message);
      setDeliveryState("queued");
      setDeliveries(await adminRequest<DeliveryResponse>("/admin/instagram/deliveries?state=queued&page=1"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Instagram navbatini tiklab bo'lmadi");
    } finally {
      setDeliveryLoading(false);
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
            <div className={`rounded-xl border p-4 ${status.ready ? "border-green-300 bg-green-50/80 dark:border-green-400/30 dark:bg-green-400/10" : connectionConfigured ? "border-red-300 bg-red-50/80 dark:border-red-400/30 dark:bg-red-400/10" : "border-amber-300 bg-amber-50/80 dark:border-amber-400/30 dark:bg-amber-400/10"}`}>
              <div className="flex gap-3">
                <span className={`grid size-11 shrink-0 place-items-center rounded-lg ${status.ready ? "bg-green-600 text-white" : connectionConfigured ? "bg-red-600 text-white" : "bg-amber-500 text-white"}`}>
                  <Instagram size={21} />
                </span>
                <div>
                  <p className="font-black">{status.ready ? "Instagram ulanishi faol" : connectionConfigured ? "Meta Instagram ulanishini bloklagan" : "Instagram sozlanishi kerak"}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{status.configurationMessage}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => void testConnection()} disabled={testing || !connectionConfigured} icon={testing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}>
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

            <div className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${status.autoPublishEnabled ? "border-green-300 bg-green-50/80 dark:border-green-400/30 dark:bg-green-400/10" : "border-amber-300 bg-amber-50/80 dark:border-amber-400/30 dark:bg-amber-400/10"}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className={`grid size-11 shrink-0 place-items-center rounded-full ${status.autoPublishEnabled ? "bg-green-600 text-white" : "bg-amber-500 text-white"}`}>
                  {status.autoPublishEnabled ? <PlayCircle size={22} /> : <PauseCircle size={22} />}
                </span>
                <div className="min-w-0">
                  <p className="font-black">Avtomatik Instagram nashri</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {status.autoPublishEnabled
                      ? "Yangi postlar navbat bo'yicha avtomatik yuboriladi"
                      : "Pauzada: yangi postlar yo'qolmaydi, navbatda saqlanadi"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={status.autoPublishEnabled}
                aria-label="Instagramga avtomatik yuborish"
                onClick={() => void toggleAutoPublish()}
                disabled={savingAutoPublish || !status.enabled}
                className={`relative h-8 w-14 shrink-0 rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 ${status.autoPublishEnabled ? "border-green-600 bg-green-600" : "border-slate-300 bg-slate-300 dark:border-slate-600 dark:bg-slate-700"}`}
              >
                <span className={`absolute top-1 size-6 rounded-full bg-white shadow-sm transition-transform ${status.autoPublishEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <CheckItem ok={status.enabled} label="Instagram nashr xizmati" value={status.enabled ? "Serverda ishga tushirilgan" : "Server sozlamasida yoqish kerak"} />
              <CheckItem ok={status.tokenConfigured} label="Access token" value={status.tokenConfigured ? "Maxfiy token saqlangan" : "Railway'da token kiritilmagan"} />
              <CheckItem ok={status.userIdConfigured} label="Instagram akkaunt" value={status.accountHint ? `ID ${status.accountHint}` : "Instagram User ID kerak"} />
              <CheckItem ok={status.publicMediaReady} label="Public media URL" value={status.publicMediaReady ? "Meta rasm/video olishi mumkin" : "HTTPS BACKEND_PUBLIC_URL kerak"} />
              <CheckItem ok={status.mediaRendererReady} label="Reel media-renderer" value={status.mediaRendererReady ? "Video Reels uchun tayyor" : "MEDIA_RENDERER sozlanmagan"} />
              <CheckItem ok={status.ready} label="Meta ulanishi" value={`${status.apiMode === "instagram_login" ? "Instagram Login" : "Facebook Login"} - ${status.apiEndpoint.replace("https://", "")}/${status.graphApiVersion}`} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {(["sent", "queued", "failed"] as DeliveryState[]).map((state) => {
                const meta = DELIVERY_META[state];
                const Icon = meta.icon;
                const count = status.posts[state];
                const active = deliveryState === state;
                return (
                  <button
                    key={state}
                    type="button"
                    onClick={() => void loadDeliveries(state)}
                    className={`min-w-0 rounded-lg border px-1.5 py-3 text-center transition focus:outline-none focus:ring-2 focus:ring-brand/40 sm:p-3 ${active ? "border-brand bg-brand/10 shadow-[0_0_0_3px_rgba(20,99,255,.12)]" : state === "failed" ? "border-red-200 bg-red-50/70 hover:border-red-300 dark:border-red-400/20 dark:bg-red-400/10" : "border-slate-200 bg-white/80 hover:border-brand/40 dark:border-white/10 dark:bg-slate-950/30"}`}
                    aria-pressed={active}
                  >
                    <Icon className={`mx-auto ${meta.tone}`} size={19} />
                    <p className="mt-2 text-xl font-black sm:text-2xl">{count}</p>
                    <p className={`text-xs font-bold ${state === "failed" ? "text-red-600 dark:text-red-300" : "text-slate-500"}`}>{meta.label}</p>
                  </button>
                );
              })}
            </div>
            {status.posts.recoverable > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-400/30 dark:bg-amber-400/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-amber-900 dark:text-amber-100">{status.posts.recoverable} ta maqola navbatdan tashqarida</p>
                    <p className="mt-1 text-sm font-semibold text-amber-800/80 dark:text-amber-100/80">Bu postlarda Instagram yoqilgan, ammo Redis navbatida faol ish yo'q.</p>
                  </div>
                  <Button size="sm" onClick={() => void repairQueue()} disabled={deliveryLoading || !status.ready} icon={deliveryLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}>
                    Navbatni tiklash
                  </Button>
                </div>
              </div>
            )}
            <div className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-950/30">
              <div className="flex items-center gap-2"><Video size={18} className="text-brand" /><h3 className="font-black">Nashr tartibi</h3></div>
              <ul className="mt-3 space-y-2 text-sm font-semibold leading-5 text-slate-600 dark:text-slate-300">
                <li>Rasmli maqola: sarlavhali muqova va asl rasm bilan Carousel Post.</li>
                <li>Videoli maqola: watermarkli Reel va asosiy tasmada ulashish.</li>
                <li>Caption: sarlavha, mavzu hashtaglari, asosiy matn, manba va @BESTTeamNEWS.</li>
                <li>Yuborilgan, navbatdagi yoki xatoli son ustiga bosing - har bir xabarni previewda ko'ring, qayta yuboring yoki navbatdan chiqaring.</li>
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
      {status && (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/10 dark:bg-slate-950/30">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><Globe2 size={20} /></span>
            <div>
              <h3 className="font-black">Instagram manbalari</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Faqat Aggregatorda yoqilgan saytlar ko'rsatiladi. O'chirilgan manba saytda ishlashda davom etadi, ammo uning yangi postlari Instagram navbatiga kirmaydi.
              </p>
            </div>
          </div>
          {!sources.length ? (
            <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">Aggregatorda yoqilgan manba yo'q.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sources.map((source) => {
                let host = source.feedUrl;
                try { host = new URL(source.feedUrl).hostname.replace(/^www\./, ""); } catch { /* Keep the feed URL. */ }
                return (
                  <div key={source.id} className={`flex min-w-0 items-center justify-between gap-3 rounded-lg border p-3 transition ${source.instagramEnabled ? "border-green-200 bg-green-50/75 dark:border-green-400/25 dark:bg-green-400/10" : "border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-slate-900/70"}`}>
                    <div className="min-w-0">
                      <p className="truncate font-black">{source.name}</p>
                      <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{host}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={source.instagramEnabled}
                      aria-label={`${source.name} manbasini Instagram uchun ${source.instagramEnabled ? "o'chirish" : "yoqish"}`}
                      onClick={() => void toggleSource(source)}
                      disabled={sourceSavingId === source.id}
                      className={`relative h-7 w-12 shrink-0 rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-wait disabled:opacity-60 ${source.instagramEnabled ? "border-green-600 bg-green-600" : "border-slate-300 bg-slate-300 dark:border-slate-600 dark:bg-slate-700"}`}
                    >
                      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform ${source.instagramEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
      {deliveryState && (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white/75 p-4 dark:border-white/10 dark:bg-slate-950/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Instagram xabarlari</p>
              <h3 className="mt-1 text-lg font-black">{DELIVERY_META[deliveryState].label}</h3>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void loadDeliveries(deliveryState, deliveries?.page ?? 1)} disabled={deliveryLoading} icon={<RefreshCcw size={15} className={deliveryLoading ? "animate-spin" : ""} />}>
              Yangilash
            </Button>
          </div>
          {deliveryLoading && !deliveries && <p className="mt-4 text-sm text-slate-500">Xabarlar yuklanmoqda...</p>}
          {deliveries && (
            <>
              {deliveryState !== "sent" && deliveries.items.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-slate-900/70">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-black">
                    <input
                      type="checkbox"
                      checked={deliveries.items.every((item) => selectedIds.has(item.id))}
                      onChange={toggleCurrentPage}
                      className="size-5 accent-blue-600"
                    />
                    Sahifadagilarni tanlash
                  </label>
                  <span className="text-xs font-bold text-slate-500">{selectedIds.size} ta tanlandi</span>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void runBulkAction("prioritize")} disabled={!selectedIds.size || deliveryLoading} icon={deliveryLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}>
                      {deliveryState === "failed" ? "Qayta yuborish" : "Tezkor yuborish"}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => void runBulkAction("cancel")} disabled={!selectedIds.size || deliveryLoading} icon={<Trash2 size={15} />}>
                      Olib tashlash
                    </Button>
                  </div>
                </div>
              )}
              {!deliveries.items.length ? (
                <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:bg-slate-950/35 dark:text-slate-400">{DELIVERY_META[deliveryState].empty}</p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {deliveries.items.map((item) => (
                    <article key={item.id} className={`relative overflow-hidden rounded-xl border bg-white transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg dark:bg-slate-950/35 ${selectedIds.has(item.id) ? "border-brand ring-2 ring-brand/25" : "border-slate-200 dark:border-white/10"}`}>
                      {deliveryState !== "sent" && (
                        <label className="absolute left-2 top-2 z-10 grid size-9 cursor-pointer place-items-center rounded-full border border-white/20 bg-slate-950/80 shadow-lg backdrop-blur" aria-label={`${item.title} postini tanlash`}>
                          <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleDelivery(item.id)} className="size-5 accent-blue-600" />
                        </label>
                      )}
                      <button type="button" onClick={() => openDeliveryPreview(item)} className="group block w-full text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand/40">
                        {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-32 w-full bg-slate-950 object-cover" /> : <div className="grid h-32 place-items-center bg-slate-950 text-slate-400"><Video size={28} /></div>}
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-brand">{item.category.name}</span><span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><Eye size={13} /> Ko'rish</span></div>
                          <p className="mt-2 line-clamp-2 font-black">{item.title}</p>
                          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{deliveryState === "failed" ? item.instagramError : item.summary}</p>
                        </div>
                      </button>
                    </article>
                  ))}
                </div>
              )}
              {deliveries.pages > 1 && (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => void loadDeliveries(deliveryState, deliveries.page - 1)} disabled={deliveries.page <= 1 || deliveryLoading} className="grid size-9 place-items-center rounded-md border border-slate-200 disabled:opacity-40 dark:border-white/15"><ChevronLeft size={17} /></button>
                  <span className="text-sm font-bold text-slate-500">{deliveries.page} / {deliveries.pages}</span>
                  <button type="button" onClick={() => void loadDeliveries(deliveryState, deliveries.page + 1)} disabled={deliveries.page >= deliveries.pages || deliveryLoading} className="grid size-9 place-items-center rounded-md border border-slate-200 disabled:opacity-40 dark:border-white/15"><ChevronRight size={17} /></button>
                </div>
              )}
            </>
          )}
        </section>
      )}
      {selectedDelivery && (
        <div className="instagram-admin-preview fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/70 px-3 pt-3 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Instagram xabar previewi" onClick={closeDeliveryPreview}>
          <div className="instagram-admin-preview-card w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-2xl border border-white/15 bg-white p-4 shadow-2xl dark:bg-slate-950 sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-brand">{selectedDelivery.category.name}</p><h3 className="mt-1 text-lg font-black">Instagram preview</h3></div><button type="button" onClick={closeDeliveryPreview} className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:text-ink dark:border-white/15 dark:text-slate-300" aria-label="Yopish"><X size={18} /></button></div>
            {selectedDelivery.previewUrl ? <img src={selectedDelivery.previewUrl} alt="" className="mt-4 max-h-[48dvh] w-full rounded-xl bg-slate-950 object-contain" /> : <div className="mt-4 grid aspect-[4/5] max-h-[48dvh] place-items-center rounded-xl bg-slate-950 text-slate-400"><Video size={34} /></div>}
            <p className="mt-4 text-lg font-black">{selectedDelivery.title}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{selectedDelivery.summary}</p>
            {selectedDelivery.instagramError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-200">{selectedDelivery.instagramError}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {selectedDelivery.instagramUrl && <a href={selectedDelivery.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-black text-white"><Instagram size={16} /> Instagramda ochish <ExternalLink size={14} /></a>}
              {selectedDelivery.instagramError && <button type="button" onClick={() => void retryDelivery(selectedDelivery.id)} disabled={deliveryLoading} className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-black text-white disabled:opacity-60"><RefreshCcw size={15} className={deliveryLoading ? "animate-spin" : ""} /> Qayta yuborish</button>}
              {!selectedDelivery.instagramSentAt && <button type="button" onClick={() => void cancelDelivery(selectedDelivery.id)} disabled={deliveryLoading} className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"><Trash2 size={15} /> Instagram navbatidan chiqarish</button>}
              <button type="button" onClick={closeDeliveryPreview} className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-black dark:border-white/15">Yopish</button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
