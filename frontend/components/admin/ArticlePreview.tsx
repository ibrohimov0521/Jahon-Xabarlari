"use client";

import { ArrowLeft } from "lucide-react";
import { MediaView } from "../MediaView";
import type { ArticleFormState, Category } from "./types";
import { Badge, Panel } from "./ui";

export function ArticlePreview({ form, categories, onBack }: { form: ArticleFormState; categories: Category[]; onBack: () => void }) {
  const category = categories.find((item) => item.id === form.categoryId);
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold hover:border-brand">
        <ArrowLeft size={16} /> Tahrirlashga qaytish
      </button>
      <Panel title="Nashr ko'rinishi (preview)">
        <article className="mx-auto max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            {category && <Badge>{category.name}</Badge>}
            {form.isBreaking && <Badge tone="red">Breaking</Badge>}
            {form.isFeatured && <Badge tone="amber">Featured</Badge>}
            {form.isEditorChoice && <Badge tone="brand">Editor choice</Badge>}
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight">{form.title || "Sarlavha kiritilmagan"}</h1>
          <p className="mt-3 text-lg text-slate-600">{form.shortDescription || form.summary || "Qisqa tavsif kiritilmagan"}</p>
          {form.mainImage && <MediaView src={form.mainImage} alt={form.title} className="mt-5 w-full rounded-lg border border-slate-200 object-cover" />}
          {form.gallery.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {form.gallery.map((src) => (
                <MediaView key={src} src={src} alt={form.title} className="aspect-video w-full rounded-md border border-slate-200 object-cover" />
              ))}
            </div>
          )}
          <div className="prose prose-slate mt-6 max-w-none whitespace-pre-wrap text-base leading-relaxed">
            {form.content || "Matn kiritilmagan"}
          </div>
        </article>
      </Panel>
    </div>
  );
}
