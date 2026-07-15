"use client";

import { Check, Copy, Facebook, Flag, Send, Share2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { submitArticleReport } from "../lib/api";

type ReportReason = "FACT_ERROR" | "TYPO" | "COPYRIGHT" | "INAPPROPRIATE" | "OTHER";

const reasons: { value: ReportReason; label: string }[] = [
  { value: "FACT_ERROR", label: "Fakt xatosi" },
  { value: "TYPO", label: "Imlo xatosi" },
  { value: "COPYRIGHT", label: "Mualliflik huquqi" },
  { value: "INAPPROPRIATE", label: "Nomaqbul material" },
  { value: "OTHER", label: "Boshqa" }
];

export function ArticleActions({ articleId, title, url }: { articleId: string; title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("FACT_ERROR");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!reportOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setReportOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [reportOpen]);

  async function share() {
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await copy();
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_600);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await submitArticleReport(articleId, { reason, details, email: email || undefined });
    setFeedback(result);
    setBusy(false);
    if (result.ok) {
      setDetails("");
      window.setTimeout(() => setReportOpen(false), 1_200);
    }
  }

  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  return (
    <>
      <div className="article-actions" aria-label="Maqola amallari">
        <button type="button" onClick={share}><Share2 size={17} /> Ulashish</button>
        <a href={telegramUrl} target="_blank" rel="noreferrer" aria-label="Telegramda ulashish"><Send size={17} /></a>
        <a href={facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebookda ulashish"><Facebook size={17} /></a>
        <button type="button" onClick={copy}>{copied ? <Check size={17} /> : <Copy size={17} />} {copied ? "Nusxalandi" : "Havola"}</button>
        <button type="button" onClick={() => { setFeedback(null); setReportOpen(true); }}><Flag size={17} /> Xato haqida</button>
      </div>

      {reportOpen && (
        <div className="article-report-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setReportOpen(false)}>
          <section className="article-report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-brand">Tahririyatga xabar</p>
                <h2 id="report-title" className="mt-1 text-xl font-black">Maqoladagi xatoni bildiring</h2>
              </div>
              <button type="button" className="article-dialog-close" onClick={() => setReportOpen(false)} aria-label="Yopish"><X size={19} /></button>
            </div>
            <form onSubmit={submit} className="mt-5 grid gap-3">
              <label className="grid gap-1.5 text-sm font-bold">
                Sabab
                <select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>
                  {reasons.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-bold">
                Tafsilot
                <textarea required minLength={10} maxLength={1500} rows={5} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Qaysi joy noto'g'ri ekanini aniq yozing..." />
              </label>
              <label className="grid gap-1.5 text-sm font-bold">
                Email <span className="font-medium text-slate-400">(ixtiyoriy)</span>
                <input type="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="siz@example.com" />
              </label>
              {feedback && <p className={`text-sm font-bold ${feedback.ok ? "text-emerald-600" : "text-red-600"}`}>{feedback.message}</p>}
              <button type="submit" disabled={busy} className="article-report-submit"><Send size={16} /> {busy ? "Yuborilmoqda..." : "Tahririyatga yuborish"}</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
