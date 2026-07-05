"use client";

import { Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { useUi } from "../lib/ui-context";

export function SubscribeBox() {
  const [sent, setSent] = useState(false);
  const { t } = useUi();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <aside className="subscribe-box news-shadow rounded-lg border border-slate-200 bg-white p-5 sm:p-7">
      <div className="flex gap-4 sm:gap-5">
        <span className="grid size-[58px] shrink-0 place-items-center rounded-full bg-brand/10 text-brand"><Send size={27} fill="currentColor" /></span>
        <div>
          <h3 className="text-[18px] font-black leading-snug text-ink">{t.subscribe.title}</h3>
          <p className="mt-3 text-[15px] leading-6 text-slate-500">{t.subscribe.body}</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white sm:flex-row">
        <input required type="email" className="h-11 min-w-0 flex-1 bg-transparent px-4 text-[14px] text-ink outline-none placeholder:text-slate-400" placeholder={t.subscribe.placeholder} />
        <button className="h-11 shrink-0 bg-brand px-5 text-[14px] font-black text-white transition hover:bg-blue-500">{t.subscribe.button}</button>
      </form>
      {sent && <p className="mt-3 text-sm font-semibold text-brand">{t.subscribe.sent}</p>}
    </aside>
  );
}
