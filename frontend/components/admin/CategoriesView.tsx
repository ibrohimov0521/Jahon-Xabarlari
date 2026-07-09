"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import type { Category } from "./types";
import { Button, ConfirmButton, Empty, ErrorBanner, IconButton, Panel } from "./ui";

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
      <form onSubmit={create} className="mb-4 flex flex-wrap items-stretch gap-2">
        <input
          className="h-10 flex-1 rounded-md border border-slate-200 bg-white px-4 outline-none focus:border-brand"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Yangi kategoriya nomi"
          required
        />
        <Button type="submit" disabled={busy} icon={<Plus size={16} />}>
          Qo'shish
        </Button>
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
                  <Button size="sm" className="flex-1" onClick={() => save(category.id)}>
                    Saqlash
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEditingId(null)}>
                    Bekor
                  </Button>
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
                    <IconButton
                      icon={<Pencil size={14} />}
                      label="Tahrirlash"
                      size="sm"
                      onClick={() => {
                        setEditingId(category.id);
                        setEditingName(category.name);
                      }}
                    />
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
