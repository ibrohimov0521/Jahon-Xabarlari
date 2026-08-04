"use client";

import { LoaderCircle, MessageCircle, PenLine, Reply, Send, X } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "../lib/use-scroll-lock";
import type { Comment } from "../lib/api";
import { getComments, submitComment } from "../lib/api";
import { useUi } from "../lib/ui-context";

const copy = {
  uz: {
    comments: "Izohlar",
    count: (value: number) => `${value} ta izoh`,
    empty: "Hozircha izoh yo'q. Birinchi bo'lib fikringizni qoldiring.",
    close: "Yopish",
    name: "Ismingiz",
    body: "Izoh yozing...",
    write: "Izoh yozish",
    send: "Yuborish",
    reply: "Javob berish",
    writingAs: "Izoh yozuvchi",
    change: "O'zgartirish",
    loading: "Izohlar yuklanmoqda...",
    sent: "Izoh joylandi",
    justNow: "hozir",
    minute: "daq",
    hour: "soat",
    day: "kun"
  },
  ru: {
    comments: "Комментарии",
    count: (value: number) => `${value} комментариев`,
    empty: "Комментариев пока нет. Оставьте первый комментарий.",
    close: "Закрыть",
    name: "Ваше имя",
    body: "Напишите комментарий...",
    write: "Написать",
    send: "Отправить",
    reply: "Ответить",
    writingAs: "Комментарий от",
    change: "Изменить",
    loading: "Загрузка комментариев...",
    sent: "Комментарий опубликован",
    justNow: "сейчас",
    minute: "мин",
    hour: "ч",
    day: "дн"
  },
  en: {
    comments: "Comments",
    count: (value: number) => `${value} comments`,
    empty: "No comments yet. Be the first to share your view.",
    close: "Close",
    name: "Your name",
    body: "Write a comment...",
    write: "Write comment",
    send: "Send",
    reply: "Reply",
    writingAs: "Commenting as",
    change: "Change",
    loading: "Loading comments...",
    sent: "Comment posted",
    justNow: "now",
    minute: "m",
    hour: "h",
    day: "d"
  }
} as const;

type DisplayComment = Comment & { pending?: boolean };

function formatCommentDate(iso: string, language: "uz" | "ru" | "en") {
  const text = copy[language];
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return text.justNow;
  if (minutes < 60) return `${minutes} ${text.minute}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${text.hour}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${text.day}`;
  const locale = language === "uz" ? "uz-UZ" : language === "ru" ? "ru-RU" : "en-GB";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function CommentSection({ articleId, initialComments }: { articleId: string; initialComments: Comment[] }) {
  const { language } = useUi();
  const text = copy[language];
  const [mounted, setMounted] = useState(false);
  const [comments, setComments] = useState<DisplayComment[]>(initialComments);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [identityEditing, setIdentityEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const feedbackTimer = useRef<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useScrollLock(panelOpen);

  useEffect(() => {
    setMounted(true);
    const rememberedName = window.localStorage.getItem("jx-comment-name")?.trim() ?? "";
    setName(rememberedName);
    setIdentityEditing(!rememberedName);
    return () => {
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    };
  }, []);

  useEffect(() => {
    setComments(initialComments);
    setPanelOpen(false);
    // Each article owns an independent comment feed. The initial server snapshot is only applied
    // when the article changes so parent re-renders cannot erase a newly submitted comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  useEffect(() => {
    if (!panelOpen) return;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setPanelOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
    };
  }, [panelOpen]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }, [body]);

  function showFeedback(next: { ok: boolean; message: string }) {
    setFeedback(next);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), next.ok ? 1600 : 3500);
  }

  async function openPanel() {
    setPanelOpen(true);
    setLoading(true);
    const latest = await getComments(articleId);
    setComments(latest);
    setLoading(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanBody = body.trim();
    if (submitting || cleanName.length < 2 || cleanBody.length < 3) return;

    const optimisticId = `pending-${Date.now()}`;
    const optimistic: DisplayComment = {
      id: optimisticId,
      name: cleanName,
      body: cleanBody,
      createdAt: new Date().toISOString(),
      pending: true
    };
    setComments((current) => [optimistic, ...current]);
    setBody("");
    setSubmitting(true);
    setFeedback(null);
    window.localStorage.setItem("jx-comment-name", cleanName);
    setIdentityEditing(false);

    const result = await submitComment(articleId, cleanName, cleanBody);
    if (result.ok) {
      const saved = result.comment ?? { ...optimistic, id: `saved-${Date.now()}` };
      setComments((current) => current.map((item) => item.id === optimisticId ? saved : item));
      showFeedback({ ok: true, message: text.sent });
    } else {
      setComments((current) => current.filter((item) => item.id !== optimisticId));
      setBody(cleanBody);
      showFeedback(result);
    }
    setSubmitting(false);
  }

  function submitWithKeyboard(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function replyTo(comment: DisplayComment) {
    setBody((current) => current || `@${comment.name} `);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function focusComposer() {
    if (name.trim().length < 2) {
      setIdentityEditing(true);
      window.setTimeout(() => nameInputRef.current?.focus(), 0);
      return;
    }
    textareaRef.current?.focus();
  }

  const sheet = panelOpen && mounted ? createPortal(
    <div className="comment-sheet-overlay" onMouseDown={() => setPanelOpen(false)} onClick={(event) => event.stopPropagation()}>
      <section className="comment-sheet" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="comment-sheet-title">
        <span className="comment-sheet-handle" aria-hidden="true" />
        <header className="comment-sheet-header">
          <div>
            <h2 id="comment-sheet-title">{text.comments}</h2>
            <p>{text.count(comments.length)}</p>
          </div>
          <div className="comment-sheet-header-actions">
            <button type="button" className="comment-write-button" onClick={focusComposer}>
              <PenLine size={15} /> <span>{text.write}</span>
            </button>
            <button ref={closeButtonRef} className="comment-sheet-close" type="button" onClick={() => setPanelOpen(false)} aria-label={text.close} title={text.close}>
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="comment-sheet-list">
          {loading && <div className="comment-sheet-state"><LoaderCircle className="animate-spin" size={22} /><span>{text.loading}</span></div>}
          {!loading && comments.length === 0 && <div className="comment-sheet-empty"><MessageCircle size={30} /><p>{text.empty}</p></div>}
          {!loading && comments.map((comment) => (
            <article key={comment.id} className={`comment-sheet-item ${comment.pending ? "is-pending" : ""}`}>
              <span className="comment-avatar" aria-hidden="true">{comment.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="comment-meta"><strong>{comment.name}</strong><time>{formatCommentDate(comment.createdAt, language)}</time></div>
                <p>{comment.body}</p>
                <button type="button" onClick={() => replyTo(comment)}><Reply size={13} /> {text.reply}</button>
              </div>
            </article>
          ))}
        </div>

        <div className="comment-composer">
          {identityEditing ? (
            <input
              ref={nameInputRef}
              autoComplete="name"
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={text.name}
              aria-label={text.name}
              className="comment-name-input"
            />
          ) : (
            <div className="comment-identity"><span>{text.writingAs}: <strong>{name}</strong></span><button type="button" onClick={() => setIdentityEditing(true)}>{text.change}</button></div>
          )}
          <form onSubmit={onSubmit} className="comment-composer-row">
            <span className="comment-avatar" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase() || "J"}</span>
            <textarea
              ref={textareaRef}
              required
              minLength={3}
              maxLength={1000}
              rows={1}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={submitWithKeyboard}
              placeholder={text.body}
              aria-label={text.body}
            />
            <button type="submit" disabled={submitting || name.trim().length < 2 || body.trim().length < 3} aria-label={text.send} title={text.send}>
              {submitting ? <LoaderCircle className="animate-spin" size={19} /> : <Send size={19} />}
            </button>
          </form>
          {feedback && <p className={`comment-feedback ${feedback.ok ? "is-success" : "is-error"}`}>{feedback.message}</p>}
        </div>
      </section>
    </div>,
    document.body
  ) : null;

  return (
    <div className="not-prose mt-4 border-t border-white/10 pt-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => void openPanel()} className="comment-toggle-button inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-black transition">
          <MessageCircle size={13} /> {text.comments} {comments.length > 0 && `(${comments.length})`}
        </button>
      </div>
      {sheet}
    </div>
  );
}
