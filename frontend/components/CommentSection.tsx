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
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 news-shadow sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <MessageCircle size={22} />
        </span>
        <h2 className="text-xl font-black text-ink">Izohlar {comments.length > 0 && `(${comments.length})`}</h2>
      </div>

      {comments.length > 0 ? (
        <div className="grid gap-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-black text-ink">{comment.name}</span>
                <span className="text-xs font-semibold text-slate-400">{formatCommentDate(comment.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-6 text-slate-600">{comment.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-slate-500">Hozircha izohlar yo'q. Birinchi bo'lib fikringizni qoldiring.</p>
      )}

      <form onSubmit={onSubmit} className="mt-6 grid gap-3 border-t border-slate-200 pt-6">
        <input
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ismingiz"
          className="h-11 rounded-md border border-slate-200 bg-white px-4 text-[14px] text-ink outline-none placeholder:text-slate-400 focus:border-brand"
        />
        <textarea
          required
          minLength={3}
          maxLength={1000}
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Izohingiz..."
          className="resize-none rounded-md border border-slate-200 bg-white px-4 py-3 text-[14px] text-ink outline-none placeholder:text-slate-400 focus:border-brand"
        />
        <button
          disabled={submitting}
          className="inline-flex h-11 w-fit items-center gap-3 rounded-md bg-brand px-5 font-black text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          <Send size={17} /> {submitting ? "Yuborilmoqda..." : "Izoh qoldirish"}
        </button>
        {feedback && <p className={`text-sm font-semibold ${feedback.ok ? "text-brand" : "text-red-600"}`}>{feedback.message}</p>}
      </form>
    </section>
  );
}
