"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import { AD_STATUSES, type AdItem, type AdStatus } from "./types";
import { Badge, Button, ConfirmButton, Empty, ErrorBanner, IconButton, Input, Panel, Select } from "./ui";

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
    setError("");
    try {
      await adminRequest(`/admin/advertisements/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status o'zgartirilmadi");
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await adminRequest(`/admin/advertisements/${id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reklama o'chirilmadi");
    }
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
              <div className="flex flex-wrap items-center gap-2">
                {AD_STATUSES.map((status) => (
                  <Button
                    key={status}
                    variant={item.status === status ? "primary" : "secondary"}
                    size="sm"
                    disabled={item.status === status}
                    onClick={() => changeStatus(item.id, status)}
                  >
                    {status}
                  </Button>
                ))}
                <IconButton icon={<Pencil size={14} />} label="Tahrirlash" size="sm" onClick={() => startEdit(item)} />
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
          <Input label="Sarlavha" value={form.title} onChange={(title) => setForm({ ...form, title })} placeholder="Reklama sarlavhasi" />
          <Input label="Joylashuv" value={form.placement} onChange={(placement) => setForm({ ...form, placement })} placeholder="header, sidebar..." />
          <Input label="Rasm URL" value={form.imageUrl} onChange={(imageUrl) => setForm({ ...form, imageUrl })} required={false} placeholder="https://..." />
          <Input label="Havola URL" value={form.targetUrl} onChange={(targetUrl) => setForm({ ...form, targetUrl })} required={false} placeholder="https://..." />
          <Select
            label="Status"
            value={form.status}
            onChange={(status) => setForm({ ...form, status })}
            options={AD_STATUSES.map((status) => ({ value: status, label: status }))}
          />
          <div className="flex gap-2">
            {editingId && (
              <Button type="button" variant="secondary" className="flex-1" onClick={cancelEdit}>
                Bekor
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={busy} icon={<Plus size={16} />}>
              {editingId ? "Saqlash" : "Qo'shish"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
