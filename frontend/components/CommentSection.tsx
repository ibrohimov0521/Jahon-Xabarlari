"use client";

import { MessageCircle, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import type { Comment } from "../lib/api";
import { submitComment } from "../lib/api";

function formatCommentDate(iso: string) {
  return new Date(iso).toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
}

export function CommentSection({ articleId, initialComments }: { articleId: string; initialComments: Comment[] }) {
  const [comments, setComments] = useState(initialComments);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
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
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 news-shadow sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <MessageCircle size={16} />
        </span>
        <h2 className="text-[15px] font-black text-ink">Izohlar {comments.length > 0 && `(${comments.length})`}</h2>
      </div>

      {comments.length > 0 ? (
        <div className="grid gap-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13.5px] font-black text-ink">{comment.name}</span>
                <span className="text-[11px] font-semibold text-slate-400">{formatCommentDate(comment.createdAt)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-5 text-slate-600">{comment.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] font-semibold text-slate-500">Hozircha izohlar yo'q. Birinchi bo'lib fikringizni qoldiring.</p>
      )}

      <form onSubmit={onSubmit} className="mt-4 grid gap-2 border-t border-slate-200 pt-4">
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
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Izohingiz..."
          className="resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5 text-ink outline-none placeholder:text-slate-400 focus:border-brand"
        />
        <div className="flex items-center justify-between gap-3">
          <button
            disabled={submitting}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-[13px] font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            <Send size={14} /> {submitting ? "Yuborilmoqda..." : "Izoh qoldirish"}
          </button>
          {feedback && <p className={`text-[12px] font-semibold ${feedback.ok ? "text-brand" : "text-red-600"}`}>{feedback.message}</p>}
        </div>
      </form>
    </section>
  );
}
