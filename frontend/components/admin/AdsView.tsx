"use client";

import {
  BarChart3,
  CalendarClock,
  ExternalLink,
  Eye,
  ImagePlus,
  Laptop,
  MousePointerClick,
  Pencil,
  Plus,
  RotateCcw,
  Smartphone,
  Trash2,
  Upload
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { adminRequest, uploadAdminMedia } from "../../lib/admin-api";
import { MediaView } from "../MediaView";
import { AD_STATUSES, type AdItem, type AdPlacement, type AdStatus, type AdSummary } from "./types";
import { Badge, Button, ConfirmButton, Empty, ErrorBanner, IconButton, Input, Pagination, Panel, SearchInput, Select, SelectFilter, Toggle } from "./ui";

const placements: Array<{ value: AdPlacement; label: string; description: string; ratio: string }> = [
  { value: "HOME_BANNER", label: "Bosh sahifa banneri", description: "Asosiy yangiliklar blokidan keyin, to'liq kenglikda", ratio: "1200 x 180" },
  { value: "HOME_FEED", label: "Yangiliklar oqimi", description: "Muharrir tanlovi va kategoriya bloklari orasida", ratio: "1200 x 300" },
  { value: "HOME_SIDEBAR", label: "Yon panel", description: "Desktopda ko'p o'qilganlar ostida; mobilda yashiriladi", ratio: "600 x 750" },
  { value: "ARTICLE_INLINE", label: "Maqola ichida", description: "Maqola matni tugagach, izohlardan oldin", ratio: "1200 x 300" },
  { value: "ARTICLE_BOTTOM", label: "Maqola oxiri", description: "O'xshash yangiliklardan oldingi tavsiya bloki", ratio: "1200 x 220" }
];

const statusLabels: Record<AdStatus, string> = { DRAFT: "Qoralama", ACTIVE: "Faol", PAUSED: "To'xtatilgan", EXPIRED: "Tugagan" };
const statusTones: Record<AdStatus, "slate" | "green" | "amber" | "red"> = { DRAFT: "slate", ACTIVE: "green", PAUSED: "amber", EXPIRED: "red" };

type AdForm = {
  title: string;
  placement: AdPlacement;
  imageUrl: string;
  targetUrl: string;
  altText: string;
  sponsorName: string;
  status: AdStatus;
  priority: string;
  showOnMobile: boolean;
  showOnDesktop: boolean;
  startAt: string;
  endAt: string;
};

const emptyAdForm: AdForm = {
  title: "",
  placement: "HOME_BANNER",
  imageUrl: "",
  targetUrl: "",
  altText: "",
  sponsorName: "",
  status: "DRAFT",
  priority: "50",
  showOnMobile: true,
  showOnDesktop: true,
  startAt: "",
  endAt: ""
};

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function placementInfo(value: AdPlacement) {
  return placements.find((item) => item.value === value) ?? placements[0];
}

function formatCampaignDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function campaignState(item: AdItem) {
  const now = Date.now();
  if (item.status !== "ACTIVE") return statusLabels[item.status];
  if (item.startAt && new Date(item.startAt).getTime() > now) return "Rejalashtirilgan";
  if (item.endAt && new Date(item.endAt).getTime() <= now) return "Muddati tugagan";
  return "Saytda ko'rinmoqda";
}

function AdPreview({ form }: { form: AdForm }) {
  const info = placementInfo(form.placement);
  const sidebar = form.placement === "HOME_SIDEBAR";
  return (
    <div className={`relative overflow-hidden rounded-lg border border-cyan-300/25 bg-[#071827] ${sidebar ? "mx-auto aspect-[4/5] max-w-[250px]" : "min-h-36"}`}>
      {form.imageUrl ? (
        <MediaView src={form.imageUrl} alt={form.altText || form.title} className="absolute inset-0 h-full w-full object-cover" videoClassName="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-slate-500"><ImagePlus size={36} /></div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/5" />
      <div className="relative flex min-h-36 flex-col justify-between p-4 text-white">
        <span className="w-fit rounded-md border border-white/25 bg-black/35 px-2 py-1 text-[10px] font-black uppercase backdrop-blur">Reklama</span>
        <div>
          <p className="text-[11px] font-bold text-cyan-100">{form.sponsorName || "Hamkor nomi"}</p>
          <h4 className="mt-1 line-clamp-2 text-base font-black">{form.title || "Reklama sarlavhasi"}</h4>
        </div>
      </div>
      <span className="absolute bottom-2 right-2 rounded bg-black/55 px-2 py-1 text-[9px] font-bold text-white/75">{info.ratio}</span>
    </div>
  );
}

export function AdsView({ ads, summary, onChanged, page, pages, onPageChange, onFiltersChange }: {
  ads: AdItem[];
  summary: AdSummary;
  onChanged: () => Promise<void>;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  onFiltersChange: (search: string, status: AdStatus | "", placement: AdPlacement | "") => void;
}) {
  const [form, setForm] = useState<AdForm>(emptyAdForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdStatus | "">("");
  const [placementFilter, setPlacementFilter] = useState<AdPlacement | "">("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totals = useMemo(() => {
    return { ...summary, ctr: summary.impressions ? (summary.clicks / summary.impressions) * 100 : 0 };
  }, [summary]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  useEffect(() => {
    const visible = new Set(ads.map((item) => item.id));
    setSelected((current) => current.filter((id) => visible.has(id)));
  }, [ads]);

  function changeSearch(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => onFiltersChange(value, statusFilter, placementFilter), 300);
  }

  function changeFilter(nextStatus: AdStatus | "", nextPlacement: AdPlacement | "") {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setStatusFilter(nextStatus);
    setPlacementFilter(nextPlacement);
    setSelected([]);
    onFiltersChange(search, nextStatus, nextPlacement);
  }

  async function bulkStatus(status: AdStatus) {
    setBulkBusy(true);
    setError("");
    try {
      await adminRequest("/admin/advertisements/bulk-status", { method: "POST", body: JSON.stringify({ ids: selected, status }) });
      setSelected([]);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reklamalar statusi o'zgartirilmadi");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    setBulkBusy(true);
    setError("");
    try {
      await adminRequest("/admin/advertisements/bulk-delete", { method: "POST", body: JSON.stringify({ ids: selected }) });
      setSelected([]);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reklamalar o'chirilmadi");
    } finally {
      setBulkBusy(false);
    }
  }

  function startEdit(ad: AdItem) {
    setEditingId(ad.id);
    setForm({
      title: ad.title,
      placement: ad.placement,
      imageUrl: ad.imageUrl ?? "",
      targetUrl: ad.targetUrl ?? "",
      altText: ad.altText ?? "",
      sponsorName: ad.sponsorName ?? "",
      status: ad.status,
      priority: String(ad.priority ?? 0),
      showOnMobile: ad.placement === "HOME_SIDEBAR" ? false : ad.showOnMobile !== false,
      showOnDesktop: ad.placement === "HOME_SIDEBAR" ? true : ad.showOnDesktop !== false,
      startAt: toLocalInput(ad.startAt),
      endAt: toLocalInput(ad.endAt)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyAdForm);
    setError("");
  }

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      if (file.type.startsWith("video/")) {
        const duration = await new Promise<number>((resolve, reject) => {
          const video = document.createElement("video");
          const url = URL.createObjectURL(file);
          video.preload = "metadata";
          video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(video.duration);
          };
          video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Video ma'lumotlarini o'qib bo'lmadi"));
          };
          video.src = url;
        });
        if (!Number.isFinite(duration) || duration > 30) throw new Error("Reklama videosi 30 soniyadan oshmasligi kerak");
      }
      const media = await uploadAdminMedia(file);
      setForm((current) => ({ ...current, imageUrl: media.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Media yuklanmadi");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.showOnMobile && !form.showOnDesktop) {
      setError("Reklama kamida mobil yoki desktop qurilmalardan birida ko'rinishi kerak");
      return;
    }
    if (form.status === "ACTIVE" && (!form.imageUrl || !form.targetUrl)) {
      setError("Faol reklama uchun rasm yoki qisqa video va bosilganda ochiladigan havola kerak");
      return;
    }
    setBusy(true);
    setError("");
    const payload = {
      ...form,
      priority: Number(form.priority),
      startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
      endAt: form.endAt ? new Date(form.endAt).toISOString() : null
    };
    try {
      if (editingId) {
        await adminRequest(`/admin/advertisements/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await adminRequest("/admin/advertisements", { method: "POST", body: JSON.stringify(payload) });
      }
      cancelEdit();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reklama saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, status: AdStatus) {
    setError("");
    try {
      await adminRequest(`/admin/advertisements/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status o'zgartirilmadi");
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await adminRequest(`/admin/advertisements/${id}`, { method: "DELETE" });
      if (editingId === id) cancelEdit();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reklama o'chirilmadi");
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Faol kampaniya", value: totals.active, icon: <Eye size={19} />, tone: "text-emerald-400" },
          { label: "Ko'rsatildi", value: totals.impressions.toLocaleString("uz-UZ"), icon: <BarChart3 size={19} />, tone: "text-cyan-400" },
          { label: "Bosishlar", value: totals.clicks.toLocaleString("uz-UZ"), icon: <MousePointerClick size={19} />, tone: "text-blue-400" },
          { label: "CTR", value: `${totals.ctr.toFixed(1)}%`, icon: <ExternalLink size={19} />, tone: "text-amber-400" }
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-cyan-300/20 bg-white/5 p-4 shadow-sm backdrop-blur-xl">
            <span className={stat.tone}>{stat.icon}</span>
            <p className="mt-3 text-xs font-bold text-slate-400">{stat.label}</p>
            <strong className="mt-1 block text-2xl font-black">{stat.value}</strong>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <Panel title="Reklama kampaniyalari" actions={<Badge tone="brand">{summary.total} ta</Badge>}>
          <ErrorBanner message={error} />
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <SearchInput value={search} onChange={changeSearch} placeholder="Kampaniya yoki reklama beruvchi..." />
              <SelectFilter value={statusFilter} onChange={(value) => changeFilter(value, placementFilter)} options={AD_STATUSES.map((status) => ({ value: status, label: statusLabels[status] }))} allLabel="Barcha statuslar" />
              <SelectFilter value={placementFilter} onChange={(value) => changeFilter(statusFilter, value)} options={placements.map((item) => ({ value: item.value, label: item.label }))} allLabel="Barcha joylashuvlar" />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-black">
              <input type="checkbox" checked={ads.length > 0 && ads.every((item) => selected.includes(item.id))} onChange={() => setSelected(ads.every((item) => selected.includes(item.id)) ? [] : ads.map((item) => item.id))} className="size-4 accent-blue-600" />
              Sahifadagilarni tanlash
            </label>
          </div>
          {selected.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-brand/20 bg-blue-50/70 p-3">
              <strong className="mr-auto text-sm text-brand">{selected.length} ta kampaniya tanlandi</strong>
              <SelectFilter value="" onChange={(value) => { if (value) void bulkStatus(value); }} options={AD_STATUSES.map((status) => ({ value: status, label: statusLabels[status] }))} allLabel="Statusni o'zgartirish" label="Ommaviy status" />
              <ConfirmButton label={bulkBusy ? "Bajarilmoqda..." : "O'chirish"} confirmLabel="Tanlangan reklamalarni o'chirish" icon={<Trash2 size={14} />} onConfirm={bulkDelete} />
            </div>
          )}
          <div className="grid gap-3">
            {ads.map((item) => {
              const info = placementInfo(item.placement);
              const impressions = item.impressions ?? 0;
              const clicks = item.clicks ?? 0;
              const ctr = impressions ? (clicks / impressions) * 100 : 0;
              return (
                <article key={item.id} className="relative grid gap-4 rounded-lg border border-slate-200 bg-white/5 p-3 sm:grid-cols-[150px_1fr] sm:p-4">
                  <input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} className="absolute right-3 top-3 z-10 size-4 accent-blue-600 sm:-left-2 sm:right-auto sm:top-4" aria-label={`${item.title} reklamasini tanlash`} />
                  <div className="relative h-28 overflow-hidden rounded-md border border-cyan-300/15 bg-[#071827]">
                    {item.imageUrl ? <MediaView src={item.imageUrl} alt={item.altText || item.title} className="h-full w-full object-cover" videoClassName="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-500"><ImagePlus size={30} /></div>}
                    <span className="absolute left-2 top-2 rounded bg-black/65 px-2 py-1 text-[9px] font-black uppercase text-white">Reklama</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><Badge tone={statusTones[item.status]}>{campaignState(item)}</Badge><span className="text-xs font-bold text-slate-400">Ustuvorlik {item.priority ?? 0}</span></div>
                        <h3 className="mt-2 truncate text-base font-black">{item.title}</h3>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{info.label} · {info.ratio}</p>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">{item.showOnMobile !== false && <Smartphone size={16} aria-label="Mobil" />}{item.showOnDesktop !== false && <Laptop size={17} aria-label="Desktop" />}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-400">
                      <span>{impressions.toLocaleString("uz-UZ")} ko'rsatish</span><span>{clicks.toLocaleString("uz-UZ")} bosish</span><span>CTR {ctr.toFixed(1)}%</span>
                      {(item.startAt || item.endAt) && <span><CalendarClock className="mr-1 inline" size={13} />{formatCampaignDate(item.startAt) ?? "Hozir"} - {formatCampaignDate(item.endAt) ?? "Cheklanmagan"}</span>}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <select aria-label="Reklama statusi" value={item.status} onChange={(event) => void changeStatus(item.id, event.target.value as AdStatus)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-black outline-none focus:border-brand">
                        {AD_STATUSES.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                      </select>
                      <IconButton icon={<Pencil size={15} />} label="Tahrirlash" size="sm" onClick={() => startEdit(item)} />
                      {item.targetUrl && <a href={item.targetUrl} target="_blank" rel="noreferrer" aria-label="Reklama havolasini ochish" title="Havolani ochish" className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-brand hover:text-brand"><ExternalLink size={14} /></a>}
                      <ConfirmButton label={<Trash2 size={14} />} onConfirm={() => remove(item.id)} />
                    </div>
                  </div>
                </article>
              );
            })}
            {!ads.length && <Empty text="Reklama kampaniyalari hali yaratilmagan" />}
          </div>
          <Pagination page={page} pages={pages} onChange={onPageChange} />
        </Panel>

        <div className="xl:sticky xl:top-5">
          <Panel title={editingId ? "Reklamani tahrirlash" : "Yangi kampaniya"} actions={editingId ? <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={cancelEdit}>Bekor</Button> : undefined}>
            <form onSubmit={submit} className="grid gap-4">
              <AdPreview form={form} />
              <Input label="Kampaniya sarlavhasi" value={form.title} onChange={(title) => setForm({ ...form, title })} placeholder="Masalan: Yozgi chegirma" maxLength={160} />
              <Input label="Reklama beruvchi" value={form.sponsorName} onChange={(sponsorName) => setForm({ ...form, sponsorName })} required={false} placeholder="Brend yoki tashkilot nomi" maxLength={100} />
              <Select
                label="Saytdagi joylashuvi"
                value={form.placement}
                onChange={(placement) => setForm({
                  ...form,
                  placement,
                  ...(placement === "HOME_SIDEBAR" ? { showOnMobile: false, showOnDesktop: true } : {})
                })}
                options={placements.map((item) => ({ value: item.value, label: item.label }))}
              />
              <div className="rounded-md border border-cyan-300/15 bg-cyan-400/5 p-3 text-xs leading-5 text-slate-400"><strong className="text-cyan-300">{placementInfo(form.placement).ratio}</strong> tavsiya qilinadi. {placementInfo(form.placement).description}.</div>

              <div className="grid gap-2">
                <span className="text-sm font-bold">Rasm yoki video</span>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1"><Input label="Media URL" aria-label="Media URL" value={form.imageUrl} onChange={(imageUrl) => setForm({ ...form, imageUrl })} required={form.status === "ACTIVE"} placeholder="https://..." /></div>
                  <input ref={fileRef} type="file" className="hidden" accept="image/*,video/mp4,video/webm" onChange={(event) => void upload(event.target.files?.[0])} />
                  <IconButton className="mt-[29px] shrink-0" icon={uploading ? <RotateCcw className="animate-spin" size={17} /> : <Upload size={17} />} label="Fayl biriktirish" onClick={() => fileRef.current?.click()} disabled={uploading} />
                </div>
                <p className="text-xs leading-5 text-slate-400">Rasm yoki MP4/WebM video. Video 30 soniyagacha bo'lishi kerak.</p>
              </div>
              <Input label="Rasm tavsifi" value={form.altText} onChange={(altText) => setForm({ ...form, altText })} required={false} placeholder="Rasmda nima tasvirlangan?" maxLength={200} />
              <Input label="Bosilganda ochiladigan havola" value={form.targetUrl} onChange={(targetUrl) => setForm({ ...form, targetUrl })} required={form.status === "ACTIVE"} placeholder="https://..." />

              {form.placement === "HOME_SIDEBAR" ? (
                <div className="flex items-center gap-2 rounded-md border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-sm font-bold text-cyan-200"><Laptop size={17} /> Faqat desktopda ko'rinadi</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Toggle label="Mobil" checked={form.showOnMobile} onChange={(showOnMobile) => setForm({ ...form, showOnMobile })} />
                  <Toggle label="Desktop" checked={form.showOnDesktop} onChange={(showOnDesktop) => setForm({ ...form, showOnDesktop })} />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Boshlanish vaqti" type="datetime-local" value={form.startAt} onChange={(startAt) => setForm({ ...form, startAt })} required={false} />
                <Input label="Tugash vaqti" type="datetime-local" value={form.endAt} onChange={(endAt) => setForm({ ...form, endAt })} required={false} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Ustuvorlik (0-100)" type="number" min="0" max="100" value={form.priority} onChange={(priority) => setForm({ ...form, priority })} />
                <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={AD_STATUSES.map((status) => ({ value: status, label: statusLabels[status] }))} />
              </div>
              <Button type="submit" size="lg" disabled={busy || uploading} icon={editingId ? <Pencil size={17} /> : <Plus size={17} />}>
                {editingId ? "O'zgarishlarni saqlash" : "Kampaniya yaratish"}
              </Button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
