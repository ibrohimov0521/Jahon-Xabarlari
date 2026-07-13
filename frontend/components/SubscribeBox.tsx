"use client";

import { Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { API_URL } from "../lib/config";
import { timeoutSignal } from "../lib/http";
import { useUi } from "../lib/ui-context";

export function SubscribeBox({ variant = "card" }: { variant?: "card" | "inline" }) {
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
        body: JSON.stringify({ email }),
        signal: timeoutSignal()
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("sent");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  // Compact single-row form for the slim footer bar: email field + button side by side.
  if (variant === "inline") {
    return (
      <form onSubmit={submit} className="site-footer-subscribe-form" aria-label={t.subscribe.title}>
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t.subscribe.placeholder}
          aria-label={t.subscribe.placeholder}
        />
        <button disabled={status === "loading"}>{t.subscribe.button}</button>
        {status === "sent" && <span className="site-footer-subscribe-msg is-ok">{t.subscribe.sent}</span>}
        {status === "error" && <span className="site-footer-subscribe-msg is-err">{t.subscribe.error}</span>}
      </form>
    );
  }

  return (
    <aside className="subscribe-box news-shadow rounded-lg border border-white/10 p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-brand">
        <Send size={18} fill="currentColor" />
      </span>
      <h3 className="mt-3 text-[15px] font-black leading-snug text-white">{t.subscribe.title}</h3>
      <p className="mt-1.5 text-[13px] leading-5 text-slate-300">{t.subscribe.body}</p>
      <form onSubmit={submit} className="mt-4 grid gap-2">
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 text-[13px] text-white outline-none placeholder:text-slate-400 focus:border-brand"
          placeholder={t.subscribe.placeholder}
        />
        <button
          disabled={status === "loading"}
          className="h-10 w-full rounded-md bg-brand text-[13px] font-black text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {t.subscribe.button}
        </button>
      </form>
      {(status === "sent" || status === "error") && (
        <p className={`mt-2 text-xs font-semibold ${status === "sent" ? "text-emerald-400" : "text-red-400"}`}>
          {status === "sent" ? t.subscribe.sent : t.subscribe.error}
        </p>
      )}
    </aside>
  );
}
