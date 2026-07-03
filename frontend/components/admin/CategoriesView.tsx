"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import type { Category } from "./types";
import { ConfirmButton, Empty, ErrorBanner, Panel } from "./ui";

export function CategoriesView({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminRequest("/admin/categories", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kategoriya saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string) {
    setError("");
    try {
      await adminRequest(`/admin/categories/${id}`, { method: "PUT", body: JSON.stringify({ name: editingName }) });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kategoriya yangilanmadi");
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await adminRequest(`/admin/categories/${id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kategoriya o'chirilmadi");
    }
  }

  return (
    <Panel title="Kategoriyalar">
      <ErrorBanner message={error} />
      <form onSubmit={create} className="mb-4 flex flex-wrap gap-2">
        <input
          className="flex-1 rounded-md border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-brand"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Yangi kategoriya nomi"
          required
        />
        <button disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 font-black text-white disabled:opacity-60">
          <Plus size={16} /> Qo'shish
        </button>
      </form>
      <div className="grid gap-3 md:grid-cols-3">
        {categories.map((category) => (
          <div key={category.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
            {editingId === category.id ? (
              <div className="flex flex-col gap-2">
                <input
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => save(category.id)} className="flex-1 rounded-md bg-brand px-3 py-1.5 text-sm font-black text-white">
                    Saqlash
                  </button>
                  <button onClick={() => setEditingId(null)} className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-bold">
                    Bekor
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong>{category.name}</strong>
                    <p className="text-sm text-slate-500">/{category.slug}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingId(category.id);
                        setEditingName(category.name);
                      }}
                      className="rounded-md border border-slate-200 bg-white p-1.5 hover:border-brand"
                    >
                      <Pencil size={14} />
                    </button>
                    <ConfirmButton label={<Trash2 size={14} />} onConfirm={() => remove(category.id)} />
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        {!categories.length && <Empty text="Kategoriya yo'q" />}
      </div>
    </Panel>
  );
}
