"use client";

import { Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { useUi } from "../lib/ui-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://backend-production-8124.up.railway.app/api";

export function SubscribeBox() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const { t } = useUi();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch(`${API_URL}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("sent");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <aside className="subscribe-box news-shadow rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
            <Send size={18} fill="currentColor" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-black leading-snug text-ink">{t.subscribe.title}</h3>
            <p className="truncate text-[13px] leading-5 text-slate-500">{t.subscribe.body}</p>
          </div>
        </div>
        <form onSubmit={submit} className="flex shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 w-full min-w-0 bg-transparent px-3 text-[13px] text-ink outline-none placeholder:text-slate-400 sm:w-56"
            placeholder={t.subscribe.placeholder}
          />
          <button
            disabled={status === "loading"}
            className="h-10 shrink-0 whitespace-nowrap bg-brand px-4 text-[13px] font-black text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {t.subscribe.button}
          </button>
        </form>
      </div>
      {(status === "sent" || status === "error") && (
        <p className={`mt-2 text-xs font-semibold ${status === "sent" ? "text-brand" : "text-red-600"}`}>
          {status === "sent" ? t.subscribe.sent : t.subscribe.error}
        </p>
      )}
    </aside>
  );
}
