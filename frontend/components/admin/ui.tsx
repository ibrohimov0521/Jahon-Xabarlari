"use client";

import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

export function Panel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black sm:text-xl">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "green" | "red" | "amber" | "slate" }) {
  const tones: Record<string, string> = {
    brand: "bg-blue-50 text-brand",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-600"
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

export function Empty({ text }: { text: string }) {
  return <p className="rounded-md bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</p>;
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  if (!message) return null;
  return <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{message}</div>;
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="fixed inset-x-4 bottom-5 z-50 mx-auto max-w-md rounded-lg border border-green-200 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-900/20 sm:inset-x-auto sm:right-6 sm:mx-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-green-50 text-green-700">
          <CheckCircle2 size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-green-700">Amal bajarildi</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-700">{message}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Xabarni yopish">
          <X size={17} />
        </button>
      </div>
    </div>
  );
}

export function LoadingBlock({ label = "Yuklanmoqda..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-blue-50 px-4 py-3 text-sm font-bold text-brand">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <input
        className="rounded-md border border-slate-200 bg-white px-4 py-3 font-normal outline-none focus:border-brand"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = "Qidirish..." }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <input
      className="w-full max-w-xs rounded-md border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-brand"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export function SelectFilter<T extends string>({
  value,
  onChange,
  options,
  allLabel = "Barchasi"
}: {
  value: T | "";
  onChange: (value: T | "") => void;
  options: readonly T[];
  allLabel?: string;
}) {
  return (
    <select
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-brand"
      value={value}
      onChange={(e) => onChange(e.target.value as T | "")}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold">
      {label}
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-slate-300"}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-5" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function ConfirmButton({
  label,
  confirmLabel = "Tasdiqlash",
  tone = "red",
  onConfirm,
  icon
}: {
  label: ReactNode;
  confirmLabel?: string;
  tone?: "red" | "brand";
  onConfirm: () => void;
  icon?: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const toneClasses = tone === "red" ? "bg-red-600 hover:bg-red-700" : "bg-brand hover:bg-blue-700";

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          className={`rounded-md px-2 py-1 text-xs font-black text-white ${toneClasses}`}
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold">
          Bekor
        </button>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-black text-white ${toneClasses}`}>
      {icon}
      {label}
    </button>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40">
        Oldingi
      </button>
      <span className="text-slate-500">{page} / {pages}</span>
      <button disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40">
        Keyingi
      </button>
    </div>
  );
}
