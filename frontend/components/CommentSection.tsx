"use client";

import { MessageCircle, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import type { Comment } from "../lib/api";
import { submitComment } from "../lib/api";

function formatCommentDate(iso: string) {
  return new Date(iso).toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
}

export function CommentSection({ articleId, initialComments }: { articleId: string; initialComments: Comment[] }) {
  const [comments] = useState(initialComments);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    const result = await submitComment(articleId, name.trim(), body.trim());
    setFeedback(result);
    if (result.ok) {
      setName("");
      setBody("");
    }
    setSubmitting(false);
  }

  return (
    <div className="not-prose mt-4 border-t border-white/10 pt-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setPanelOpen((value) => !value)}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 text-[12px] font-black text-cyan-50 shadow-sm shadow-cyan-500/10 transition hover:border-cyan-300/55 hover:bg-cyan-400/18 hover:text-white"
        >
          <MessageCircle size={13} /> Izohlar {comments.length > 0 && `(${comments.length})`}
        </button>
      </div>

      {panelOpen && (
        <div className="mt-3 rounded-lg border border-cyan-300/20 bg-slate-950/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-bold text-slate-300">
              {comments.length ? `${comments.length} ta izoh` : "Hozircha izoh yo'q."}
            </p>
            <button
              type="button"
              onClick={() => setFormOpen((value) => !value)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-[12px] font-black text-white transition hover:bg-blue-500"
            >
              <Send size={13} /> {formOpen ? "Yopish" : "Izoh qoldirish"}
            </button>
          </div>

          {comments.length > 0 && (
            <div className="mt-3 grid gap-2">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-black text-ink">{comment.name}</span>
                    <span className="text-[11px] font-semibold text-slate-400">{formatCommentDate(comment.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-[13px] leading-5 text-slate-600">{comment.body}</p>
                </div>
              ))}
            </div>
          )}

          {formOpen && (
            <form onSubmit={onSubmit} className="mt-3 grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-[160px_1fr_auto]">
              <input
                required
                minLength={2}
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ismingiz"
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-ink outline-none placeholder:text-slate-400 focus:border-brand"
              />
              <textarea
                required
                minLength={3}
                maxLength={1000}
                rows={1}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Izohingiz..."
                className="min-h-9 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5 text-ink outline-none placeholder:text-slate-400 focus:border-brand"
              />
              <button
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-3.5 text-[13px] font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
              >
                <Send size={14} /> {submitting ? "..." : "Yuborish"}
              </button>
              {feedback && <p className={`text-[12px] font-semibold sm:col-span-3 ${feedback.ok ? "text-brand" : "text-red-600"}`}>{feedback.message}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
