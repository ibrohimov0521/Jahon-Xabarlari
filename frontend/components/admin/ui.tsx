"use client";

import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Shared form/action primitives. Every admin button and field should come from
// here so the panel stays visually consistent (one radius, one padding scale,
// one hover/disabled/focus treatment) instead of ad-hoc per-view Tailwind.
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-blue-700",
  secondary: "border border-slate-200 bg-white text-ink hover:border-brand hover:text-brand",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-slate-600 hover:bg-slate-100"
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-base"
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

const iconButtonSizes: Record<"sm" | "md", string> = { sm: "size-8", md: "size-10" };

// Icon-only button. `label` is required and becomes the accessible name + tooltip.
export function IconButton({
  icon,
  label,
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: ReactNode;
  label: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-md font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${iconButtonSizes[size]} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
}

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

export function Textarea({
  label,
  value,
  onChange,
  rows = 4,
  required = true,
  placeholder,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <textarea
        className="rounded-md border border-slate-200 bg-white px-4 py-3 font-normal outline-none focus:border-brand"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        required={required}
        placeholder={placeholder}
        {...rest}
      />
    </label>
  );
}

// Labelled form select (distinct from the compact SelectFilter used in toolbars).
export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  required = true
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <select
        className="rounded-md border border-slate-200 bg-white px-4 py-3 font-normal outline-none focus:border-brand"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        required={required}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <Button
          variant={tone === "red" ? "danger" : "primary"}
          size="sm"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
          Bekor
        </Button>
      </span>
    );
  }

  return (
    <Button variant={tone === "red" ? "danger" : "primary"} size="sm" icon={icon} onClick={() => setConfirming(true)}>
      {label}
    </Button>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Oldingi
      </Button>
      <span className="text-slate-500">{page} / {pages}</span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Keyingi
      </Button>
    </div>
  );
}
