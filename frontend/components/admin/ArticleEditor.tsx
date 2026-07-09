"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { adminRequest, uploadAdminMedia } from "../../lib/admin-api";
import { ARTICLE_STATUSES, type Article, type ArticleFlags, type ArticleFormState, type Category, FLAG_LABELS, emptyArticleForm } from "./types";
import { Button, ErrorBanner, Input, Panel, Select, Textarea, Toggle } from "./ui";

const EDITOR_STATUSES = ARTICLE_STATUSES.filter((status) => status !== "SCHEDULED");

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
    seoTitle: article.seoTitle ?? "",
    seoDescription: article.seoDescription ?? "",
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
      if (articleId) {
        await adminRequest(`/admin/articles/${articleId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await adminRequest("/admin/articles", { method: "POST", body: JSON.stringify(form) });
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
      setForm((current) => ({ ...current, shortDescription: result.shortDescription }));
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
          <Input label="Sarlavha" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <Input label="Qisqa tavsif" value={form.summary} onChange={(value) => setForm({ ...form, summary: value })} />
          <div className="grid gap-2">
            <Input label="AI qisqa izoh" value={form.shortDescription} onChange={(value) => setForm({ ...form, shortDescription: value })} required={false} />
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
            <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-black transition hover:border-brand hover:text-brand">
              {uploading ? "Fayl yuklanmoqda..." : "Fayl biriktirish (rasm/video)"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                className="hidden"
                disabled={uploading}
                onChange={(event) => uploadMainFile(event.target.files?.[0])}
              />
            </label>
          </div>
          <Input label="SEO sarlavha" value={form.seoTitle} onChange={(value) => setForm({ ...form, seoTitle: value })} required={false} />
          <Input label="SEO tavsif" value={form.seoDescription} onChange={(value) => setForm({ ...form, seoDescription: value })} required={false} />
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
