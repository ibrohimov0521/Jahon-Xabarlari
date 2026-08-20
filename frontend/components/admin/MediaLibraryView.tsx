"use client";

import { CheckCircle2, Copy, FileImage, ImageIcon, RefreshCcw, Trash2, UploadCloud, Video } from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminRequest, uploadAdminMedia } from "../../lib/admin-api";
import { isVideoUrl } from "../../lib/media";
import { MediaView } from "../MediaView";
import { Button, Empty, ErrorBanner, LoadingBlock, Panel, SuccessBanner } from "./ui";

type MediaItem = {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

type MediaResponse = {
  items: MediaItem[];
  total: number;
  page: number;
  pages: number;
};

const pageSize = 24;

function formatSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Noma'lum sana";
  return parsed.toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function MediaLibraryView() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadMedia = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await adminRequest<MediaResponse>(`/admin/media?page=${nextPage}&pageSize=${pageSize}`);
      setItems(data.items);
      setPage(data.page);
      setPages(Math.max(1, data.pages));
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Media ro'yxati yuklanmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMedia(1);
  }, [loadMedia]);

  const summary = useMemo(() => {
    const imageCount = items.filter((item) => item.mimeType.startsWith("image/") || !isVideoUrl(item.url)).length;
    const videoCount = items.filter((item) => item.mimeType.startsWith("video/") || isVideoUrl(item.url)).length;
    return { imageCount, videoCount };
  }, [items]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    setError("");
    setMessage("");
    try {
      for (const file of files) {
        await uploadAdminMedia(file);
      }
      setMessage(`${files.length} ta media fayl yuklandi`);
      await loadMedia(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Media yuklashda xato");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Media URL nusxalandi");
    } catch {
      setError("URL nusxalash uchun brauzer ruxsati kerak");
    }
  }

  async function deleteMedia(item: MediaItem) {
    const ok = window.confirm("Bu media faylni o'chirasizmi? Maqolalarda ishlatilayotgan fayl o'chmaydi.");
    if (!ok) return;

    setError("");
    setMessage("");
    try {
      await adminRequest(`/admin/media/${item.id}`, { method: "DELETE" });
      setMessage("Media fayl o'chirildi");
      await loadMedia(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Media o'chirilmadi");
    }
  }

  return (
    <Panel
      title="Media kutubxona"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<RefreshCcw size={16} />} onClick={() => { void loadMedia(page); }} disabled={loading || uploading}>
            Yangilash
          </Button>
          <Button icon={<UploadCloud size={17} />} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Yuklanmoqda..." : "Media yuklash"}
          </Button>
          <input ref={fileInputRef} className="hidden" type="file" accept="image/*,video/*" multiple onChange={handleUpload} />
        </div>
      }
    >
      <div className="space-y-4 pb-24 lg:pb-0">
        <ErrorBanner message={error} />
        <SuccessBanner message={message} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
            <p className="text-sm font-bold text-slate-400">Jami media</p>
            <p className="mt-2 text-3xl font-black text-white">{total}</p>
          </div>
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
            <p className="text-sm font-bold text-slate-400">Rasmlar</p>
            <p className="mt-2 flex items-center gap-2 text-3xl font-black text-white"><ImageIcon size={24} className="text-brand" /> {summary.imageCount}</p>
          </div>
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
            <p className="text-sm font-bold text-slate-400">Videolar</p>
            <p className="mt-2 flex items-center gap-2 text-3xl font-black text-white"><Video size={24} className="text-brand" /> {summary.videoCount}</p>
          </div>
        </div>

        {loading ? <LoadingBlock label="Media yuklanmoqda..." /> : null}
        {!loading && !items.length ? <Empty text="Hozircha media fayllar yo'q. Rasm yoki video yuklang." /> : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((item) => {
            const video = item.mimeType.startsWith("video/") || isVideoUrl(item.url);
            return (
              <article key={item.id} className="overflow-hidden rounded-lg border border-cyan-300/20 bg-slate-950/45 shadow-lg shadow-black/15">
                <div className="relative aspect-video bg-slate-950">
                  <MediaView src={item.url} alt="Media fayl" className="size-full object-contain" videoClassName="size-full object-contain" isVideo={video} />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-black text-white backdrop-blur-md">
                    {video ? <Video size={13} /> : <FileImage size={13} />}
                    {video ? "Video" : "Rasm"}
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-black text-white">{item.mimeType || "media/fayl"}</p>
                      <p className="mt-1 font-semibold text-slate-400">{formatDate(item.createdAt)}</p>
                    </div>
                    <span className="rounded-full bg-slate-900/70 px-3 py-1 text-xs font-black text-slate-300">{formatSize(item.size)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" variant="secondary" size="sm" icon={<Copy size={14} />} onClick={() => { void copyUrl(item.url); }}>
                      URL
                    </Button>
                    <Button className="flex-1" variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => { void deleteMedia(item); }}>
                      O'chirish
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {pages > 1 ? (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => { void loadMedia(page - 1); }}>
              Oldingi
            </Button>
            <span className="text-sm font-black text-slate-300">{page} / {pages}</span>
            <Button variant="secondary" disabled={page >= pages || loading} onClick={() => { void loadMedia(page + 1); }}>
              Keyingi
            </Button>
          </div>
        ) : null}

        <div className="flex items-start gap-3 rounded-lg border border-green-300/20 bg-green-400/10 p-4 text-sm font-semibold text-green-100">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-300" />
          <p>Bu yerdan yuklangan media maqola editorida URL orqali ishlaydi. Rasm ko'rsatilganda yangi BEST TEAM watermark avtomatik qo'llanadi.</p>
        </div>
      </div>
    </Panel>
  );
}
