"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { useUi } from "../lib/ui-context";

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { t } = useUi();

  if (!open) return null;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const q = String(formData.get("q") ?? "").trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-slate-950/55 px-4 py-24 backdrop-blur-md">
      <form onSubmit={submitSearch} className="search-shell mx-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-white/35 bg-white/90 p-2 shadow-2xl ring-1 ring-slate-900/5 backdrop-blur-xl">
        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-brand">
          <Search size={22} />
        </div>
        <input autoFocus name="q" className="h-14 min-w-0 flex-1 bg-transparent px-1 text-lg font-semibold text-ink outline-none placeholder:text-slate-400" placeholder={t.search.placeholder} />
        <button className="h-12 rounded-xl bg-brand px-7 font-black text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-0.5 hover:bg-blue-500" type="submit">{t.search.button}</button>
        <button aria-label={t.search.close} onClick={onClose} className="grid size-12 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-ink" type="button">
          <X />
        </button>
      </form>
    </div>
  );
}
