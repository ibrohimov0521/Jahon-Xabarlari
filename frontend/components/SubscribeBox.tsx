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
    <aside className="rounded-lg bg-ink p-7 text-white news-shadow">
      <div className="flex gap-5">
        <span className="grid size-[58px] shrink-0 place-items-center rounded-full bg-white/10"><Send size={28} fill="white" /></span>
        <div>
          <h3 className="text-[18px] font-black leading-snug">{t.subscribe.title}</h3>
          <p className="mt-3 text-[15px] leading-6 text-slate-100">{t.subscribe.body}</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 flex overflow-hidden rounded-md border border-white/20">
        <input required type="email" className="h-11 min-w-0 flex-1 bg-transparent px-4 text-[14px] outline-none placeholder:text-slate-300" placeholder={t.subscribe.placeholder} />
        <button className="h-11 bg-brand px-5 text-[14px] font-black transition hover:bg-blue-500">{t.subscribe.button}</button>
      </form>
      {sent && <p className="mt-3 text-sm text-blue-100">{t.subscribe.sent}</p>}
    </aside>
  );
}
