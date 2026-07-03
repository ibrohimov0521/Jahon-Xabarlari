"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { AD_STATUSES, type AdItem, type AdStatus } from "./types";
import { Badge, ConfirmButton, Empty, ErrorBanner, Panel } from "./ui";

const emptyAdForm = { title: "", placement: "header", imageUrl: "", targetUrl: "", status: "DRAFT" as AdStatus };

export function AdsView({ ads, onChanged }: { ads: AdItem[]; onChanged: () => void }) {
  const [form, setForm] = useState(emptyAdForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function startEdit(ad: AdItem) {
    setEditingId(ad.id);
    setForm({ title: ad.title, placement: ad.placement, imageUrl: ad.imageUrl ?? "", targetUrl: ad.targetUrl ?? "", status: ad.status });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyAdForm);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editingId) {
        await adminRequest(`/admin/advertisements/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await adminRequest("/admin/advertisements", { method: "POST", body: JSON.stringify(form) });
      }
      cancelEdit();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reklama saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, status: AdStatus) {
    await adminRequest(`/admin/advertisements/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    onChanged();
  }

  async function remove(id: string) {
    await adminRequest(`/admin/advertisements/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel title="Reklamalar">
        <div className="space-y-3">
          {ads.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-4">
              <div>
                <strong>{item.title}</strong>
                <p className="text-sm text-slate-500">
                  {item.placement} · <Badge>{item.status}</Badge>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {AD_STATUSES.map((status) => (
                  <button key={status} onClick={() => changeStatus(item.id, status)} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold hover:border-brand">
                    {status}
                  </button>
                ))}
                <button onClick={() => startEdit(item)} className="rounded-md border border-slate-200 p-2 hover:border-brand">
                  <Pencil size={14} />
                </button>
                <ConfirmButton label={<Trash2 size={14} />} onConfirm={() => remove(item.id)} />
              </div>
            </div>
          ))}
          {!ads.length && <Empty text="Reklama yozuvlari yo'q" />}
        </div>
      </Panel>
      <Panel title={editingId ? "Reklamani tahrirlash" : "Yangi reklama"}>
        <ErrorBanner message={error} />
        <form onSubmit={submit} className="grid gap-3">
          <input className="rounded-md border border-slate-200 bg-white px-4 py-2.5" placeholder="Sarlavha" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className="rounded-md border border-slate-200 bg-white px-4 py-2.5" placeholder="Joylashuv (header, sidebar...)" value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} required />
          <input className="rounded-md border border-slate-200 bg-white px-4 py-2.5" placeholder="Rasm URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          <input className="rounded-md border border-slate-200 bg-white px-4 py-2.5" placeholder="Havola URL" value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} />
          <select className="rounded-md border border-slate-200 bg-white px-4 py-2.5" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AdStatus })}>
            {AD_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <div className="flex gap-2">
            {editingId && (
              <button type="button" onClick={cancelEdit} className="flex-1 rounded-md border border-slate-200 px-4 py-2.5 font-bold">
                Bekor
              </button>
            )}
            <button disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 font-black text-white disabled:opacity-60">
              <Plus size={16} /> {editingId ? "Saqlash" : "Qo'shish"}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
