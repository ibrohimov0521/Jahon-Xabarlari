"use client";

import { useMemo, useState } from "react";
import { COMMENT_STATUSES, type CommentItem, type CommentStatus } from "./types";
import { Badge, Empty, Panel, SearchInput, SelectFilter } from "./ui";

export function CommentsView({ comments, onStatus }: { comments: CommentItem[]; onStatus: (id: string, status: CommentStatus) => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CommentStatus | "">("");

  const filtered = useMemo(() => {
    return comments.filter((item) => {
      if (status && item.status !== status) return false;
      if (search && !item.body.toLowerCase().includes(search.toLowerCase()) && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [comments, search, status]);

  return (
    <Panel
      title="Izohlar moderatsiyasi"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Ism yoki matn bo'yicha qidirish..." />
          <SelectFilter value={status} onChange={setStatus} options={COMMENT_STATUSES} allLabel="Barcha statuslar" />
        </div>
      }
    >
      <div className="space-y-3">
        {filtered.map((item) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{item.name}</strong>
              <Badge>{item.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            <p className="mt-2 text-xs text-slate-500">{item.article?.title ?? "Maqola topilmadi"}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onStatus(item.id, "APPROVED")} className="rounded-md bg-green-600 px-3 py-2 text-sm font-bold text-white">
                Tasdiqlash
              </button>
              <button onClick={() => onStatus(item.id, "DELETED")} className="rounded-md bg-red-600 px-3 py-2 text-sm font-bold text-white">
                O'chirish
              </button>
            </div>
          </div>
        ))}
        {!filtered.length && <Empty text="Moderatsiya qilinadigan izoh yo'q" />}
      </div>
    </Panel>
  );
}
