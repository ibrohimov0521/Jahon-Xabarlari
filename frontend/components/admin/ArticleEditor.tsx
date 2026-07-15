"use client";

import { Paperclip, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { adminRequest, uploadAdminMedia } from "../../lib/admin-api";
import { MediaView } from "../MediaView";
import { ARTICLE_STATUSES, type Article, type ArticleFlags, type ArticleFormState, type Category, FLAG_LABELS, emptyArticleForm } from "./types";
import { Button, ErrorBanner, Input, Panel, Select, Textarea, Toggle } from "./ui";

const EDITOR_STATUSES = ARTICLE_STATUSES.filter((status) => status !== "SCHEDULED");

function trimSeoText(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  const shortened = normalized.slice(0, maxLength + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > maxLength * 0.65 ? lastSpace : maxLength).trim()}...`;
}

function automaticSeoTitle(title: string) {
  return trimSeoText(title, 68);
}

function automaticSeoDescription(shortDescription: string, summary: string) {
  return trimSeoText(shortDescription.trim() || summary, 160);
}

function updateWithAutomaticSeo(current: ArticleFormState, updates: Partial<ArticleFormState>): ArticleFormState {
  const currentAutoTitle = automaticSeoTitle(current.title);
  const currentAutoDescription = automaticSeoDescription(current.shortDescription, current.summary);
  const next = { ...current, ...updates };
  return {
    ...next,
    seoTitle: !current.seoTitle.trim() || current.seoTitle === currentAutoTitle ? automaticSeoTitle(next.title) : current.seoTitle,
    seoDescription:
      !current.seoDescription.trim() || current.seoDescription === currentAutoDescription
        ? automaticSeoDescription(next.shortDescription, next.summary)
        : current.seoDescription
  };
}

function toFormState(article: Article): ArticleFormState {
  return {
    title: article.title,
    summary: article.summary,
    shortDescription: article.shortDescription ?? "",
    content: article.content,
    mainImage: article.mainImage ?? "",
    gallery: article.gallery ?? [],
    categoryId: article.categoryId ?? "",
    extraCategoryIds: article.extraCategoryIds ?? [],
    status: article.status,
    seoTitle: article.seoTitle?.trim() || automaticSeoTitle(article.title),
    seoDescription: article.seoDescription?.trim() || automaticSeoDescription(article.shortDescription ?? "", article.summary),
    isBreaking: article.isBreaking,
    isFeatured: article.isFeatured,
    isEditorChoice: article.isEditorChoice,
    showOnHome: article.showOnHome,
    showInSlider: article.showInSlider,
    showInSidebar: article.showInSidebar,
    showInLatest: article.showInLatest,
    showInPopular: article.showInPopular
  };
}

export function ArticleEditor({
  articleId,
  categories,
  onSaved,
  onPreview
}: {
  articleId: string | null;
  categories: Category[];
  onSaved: () => void;
  onPreview: (form: ArticleFormState) => void;
}) {
  const [form, setForm] = useState<ArticleFormState>({ ...emptyArticleForm, categoryId: categories[0]?.id ?? "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!articleId) {
      setForm({ ...emptyArticleForm, categoryId: categories[0]?.id ?? "" });
      return;
    }
    setLoading(true);
    setError("");
    adminRequest<Article>(`/admin/articles/${articleId}`)
      .then((article) => setForm(toFormState(article)))
      .catch((err) => setError(err instanceof Error ? err.message : "Maqola topilmadi"))
      .finally(() => setLoading(false));
    // Deliberately excludes `categories`: it gets a new array reference on every parent
    // refresh, and re-running this would silently discard in-progress form edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  // Categories can arrive after mount (async load); backfill the default once, without
  // re-running on every subsequent categories refetch.
  useEffect(() => {
    if (!articleId && !form.categoryId && categories[0]) {
      setForm((current) => ({ ...current, categoryId: categories[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, articleId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: ArticleFormState = {
        ...form,
        seoTitle: form.seoTitle.trim() || automaticSeoTitle(form.title),
        seoDescription: form.seoDescription.trim() || automaticSeoDescription(form.shortDescription, form.summary)
      };
      if (articleId) {
        await adminRequest(`/admin/articles/${articleId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await adminRequest("/admin/articles", { method: "POST", body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Maqola saqlanmadi");
    } finally {
      setSaving(false);
    }
  }

  async function uploadMainFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadAdminMedia(file);
      setForm((current) => ({ ...current, mainImage: uploaded.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fayl yuklanmadi");
    } finally {
      setUploading(false);
    }
  }

  async function generateShortDescription() {
    setAiGenerating(true);
    setError("");
    try {
      const result = await adminRequest<{ shortDescription: string }>("/admin/ai/short-description", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          summary: form.summary,
          content: form.content
        })
      });
      setForm((current) => updateWithAutomaticSeo(current, { shortDescription: result.shortDescription }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI qisqa izoh yaratilmadi");
    } finally {
      setAiGenerating(false);
    }
  }

  if (loading) {
    return (
      <Panel title="Maqola">
        <p className="text-sm text-slate-500">Yuklanmoqda...</p>
      </Panel>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel title={articleId ? "Maqolani tahrirlash" : "Yangi maqola"}>
        <ErrorBanner message={error} />
        <div className="grid gap-4">
          <Input label="Sarlavha" value={form.title} onChange={(value) => setForm((current) => updateWithAutomaticSeo(current, { title: value }))} />
          <Input label="Qisqa tavsif" value={form.summary} onChange={(value) => setForm((current) => updateWithAutomaticSeo(current, { summary: value }))} />
          <div className="grid gap-2">
            <Input
              label="AI qisqa izoh"
              value={form.shortDescription}
              onChange={(value) => setForm((current) => updateWithAutomaticSeo(current, { shortDescription: value }))}
              required={false}
            />
            <button
              type="button"
              onClick={generateShortDescription}
              disabled={aiGenerating || form.title.trim().length < 3 || form.content.trim().length < 20}
              className="inline-flex w-fit items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-brand transition hover:border-brand hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles size={16} />
              {aiGenerating ? "Yaratilmoqda..." : "Qisqa izoh yaratish"}
            </button>
          </div>
          <Textarea label="Asosiy matn" value={form.content} onChange={(value) => setForm({ ...form, content: value })} rows={12} />
          <div className="grid gap-2">
            <Input label="Rasm/video URL" value={form.mainImage} onChange={(value) => setForm({ ...form, mainImage: value })} required={false} />
            {form.mainImage ? (
              <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-950/95 p-2">
                <MediaView
                  src={form.mainImage}
                  alt={form.title || "Maqola media fayli"}
                  className="mx-auto max-h-72 w-full rounded-md object-contain"
                  videoClassName="mx-auto max-h-72 w-full rounded-md bg-black object-contain"
                  optimizedWidth={1200}
                />
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, mainImage: "" }))}
                  className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/20 bg-slate-950/85 text-white shadow-lg transition hover:bg-red-600"
                  aria-label="Media faylni olib tashlash"
                  title="Media faylni olib tashlash"
                >
                  <X size={17} />
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-brand hover:text-brand">
                <Paperclip size={15} />
                {uploading ? "Yuklanmoqda..." : "Fayl tanlash"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    void uploadMainFile(file);
                  }}
                />
              </label>
              <span className="text-xs font-semibold text-slate-500">JPG, PNG, WebP, GIF, MP4, WebM yoki MOV</span>
            </div>
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div>
              <p className="text-sm font-black text-slate-800">SEO</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">Sarlavha va tavsifdan avtomatik to'ladi. Kerak bo'lsa qo'lda o'zgartirish mumkin.</p>
            </div>
            <Input label="SEO sarlavha" value={form.seoTitle} onChange={(value) => setForm({ ...form, seoTitle: value })} required={false} />
            <Input label="SEO tavsif" value={form.seoDescription} onChange={(value) => setForm({ ...form, seoDescription: value })} required={false} />
          </div>
        </div>
      </Panel>
      <Panel title="Ko'rinishi">
        <div className="grid gap-4">
          <Select
            label="Asosiy kategoriya"
            value={form.categoryId}
            onChange={(categoryId) => setForm({ ...form, categoryId })}
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
          />
          <div className="grid gap-2">
            <p className="text-sm font-bold">Qo'shimcha kategoriyalar</p>
            <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
              {categories
                .filter((category) => category.id !== form.categoryId)
                .map((category) => {
                  const checked = form.extraCategoryIds.includes(category.id);
                  return (
                    <label key={category.id} className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...form.extraCategoryIds, category.id]
                            : form.extraCategoryIds.filter((id) => id !== category.id);
                          setForm({ ...form, extraCategoryIds: next });
                        }}
                      />
                      {category.name}
                    </label>
                  );
                })}
            </div>
            <p className="text-xs font-semibold text-slate-500">Asosiy menyuda bitta kategoriya ko'rinadi, qo'shimcha kategoriyalar faqat tegishli bo'limlarda topilishi uchun.</p>
          </div>
          <Select
            label="Status"
            value={form.status}
            onChange={(status) => setForm({ ...form, status: status as ArticleFormState["status"] })}
            options={EDITOR_STATUSES.map((status) => ({ value: status, label: status }))}
          />
          {FLAG_LABELS.map(([key, label]) => (
            <Toggle key={key} label={label} checked={form[key as keyof ArticleFlags]} onChange={(checked) => setForm({ ...form, [key]: checked })} />
          ))}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="lg" className="flex-1" onClick={() => onPreview(form)}>
              Ko'rib chiqish
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={saving}>
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </div>
        </div>
      </Panel>
    </form>
  );
}
