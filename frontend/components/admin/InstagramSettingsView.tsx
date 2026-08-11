"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock3, ExternalLink, Eye, Instagram, Loader2, RefreshCcw, Send, ShieldCheck, Trash2, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { Button, ErrorBanner, Panel, SuccessBanner } from "./ui";

type InstagramStatus = {
  enabled: boolean;
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

const DELIVERY_META: Record<DeliveryState, { label: string; empty: string; icon: typeof Send; tone: string }> = {
  sent: { label: "Yuborilgan", empty: "Hali Instagramga yuborilgan maqola yo'q.", icon: Send, tone: "text-brand" },
  queued: { label: "Navbatda", empty: "Hozir Instagram navbatida maqola yo'q.", icon: Clock3, tone: "text-amber-600 dark:text-amber-300" },
  failed: { label: "Xato", empty: "Instagram yuborish xatosi yo'q.", icon: CircleAlert, tone: "text-red-600 dark:text-red-300" }
};

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
  const [deliveryState, setDeliveryState] = useState<DeliveryState | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryResponse | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<InstagramDelivery | null>(null);

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

  async function loadDeliveries(state: DeliveryState, page = 1) {
    setDeliveryState(state);
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

  async function retryDelivery(articleId: string) {
    setDeliveryLoading(true);
    setError("");
    try {
      await adminRequest(`/admin/articles/${articleId}/instagram/retry`, { method: "POST" });
      setMessage("Maqola Instagram navbatiga qayta yuborildi");
      setSelectedDelivery(null);
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
      setSelectedDelivery(null);
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
              <CheckItem ok={status.ready} label="Meta ulanishi" value={`${status.apiMode === "instagram_login" ? "Instagram Login" : "Facebook Login"} - ${status.apiEndpoint.replace("https://", "")}/${status.graphApiVersion}`} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
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
                    className={`rounded-lg border p-3 text-center transition focus:outline-none focus:ring-2 focus:ring-brand/40 ${active ? "border-brand bg-brand/10 shadow-[0_0_0_3px_rgba(20,99,255,.12)]" : state === "failed" ? "border-red-200 bg-red-50/70 hover:border-red-300 dark:border-red-400/20 dark:bg-red-400/10" : "border-slate-200 bg-white/80 hover:border-brand/40 dark:border-white/10 dark:bg-slate-950/30"}`}
                    aria-pressed={active}
                  >
                    <Icon className={`mx-auto ${meta.tone}`} size={19} />
                    <p className="mt-2 text-2xl font-black">{count}</p>
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
              {!deliveries.items.length ? (
                <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:bg-slate-950/35 dark:text-slate-400">{DELIVERY_META[deliveryState].empty}</p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {deliveries.items.map((item) => (
                    <button key={item.id} type="button" onClick={() => setSelectedDelivery(item)} className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-white/10 dark:bg-slate-950/35">
                      {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-32 w-full bg-slate-950 object-cover" /> : <div className="grid h-32 place-items-center bg-slate-950 text-slate-400"><Video size={28} /></div>}
                      <div className="p-3">
                        <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-brand">{item.category.name}</span><span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><Eye size={13} /> Ko'rish</span></div>
                        <p className="mt-2 line-clamp-2 font-black">{item.title}</p>
                        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{deliveryState === "failed" ? item.instagramError : item.summary}</p>
                      </div>
                    </button>
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
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Instagram xabar previewi">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-white p-4 shadow-2xl dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-brand">{selectedDelivery.category.name}</p><h3 className="mt-1 text-lg font-black">Instagram preview</h3></div><button type="button" onClick={() => setSelectedDelivery(null)} className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:text-ink dark:border-white/15 dark:text-slate-300" aria-label="Yopish"><X size={18} /></button></div>
            {selectedDelivery.previewUrl ? <img src={selectedDelivery.previewUrl} alt="" className="mt-4 aspect-[4/5] w-full rounded-xl bg-slate-950 object-cover" /> : <div className="mt-4 grid aspect-[4/5] place-items-center rounded-xl bg-slate-950 text-slate-400"><Video size={34} /></div>}
            <p className="mt-4 text-lg font-black">{selectedDelivery.title}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{selectedDelivery.summary}</p>
            {selectedDelivery.instagramError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-200">{selectedDelivery.instagramError}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {selectedDelivery.instagramUrl && <a href={selectedDelivery.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-black text-white"><Instagram size={16} /> Instagramda ochish <ExternalLink size={14} /></a>}
              {selectedDelivery.instagramError && <button type="button" onClick={() => void retryDelivery(selectedDelivery.id)} disabled={deliveryLoading} className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-black text-white disabled:opacity-60"><RefreshCcw size={15} className={deliveryLoading ? "animate-spin" : ""} /> Qayta yuborish</button>}
              {!selectedDelivery.instagramSentAt && <button type="button" onClick={() => void cancelDelivery(selectedDelivery.id)} disabled={deliveryLoading} className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"><Trash2 size={15} /> Instagram navbatidan chiqarish</button>}
              <button type="button" onClick={() => setSelectedDelivery(null)} className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-black dark:border-white/15">Yopish</button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
