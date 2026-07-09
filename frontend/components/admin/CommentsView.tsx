"use client";

import { Check, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { COMMENT_STATUSES, type CommentItem, type CommentStatus } from "./types";
import { Badge, Button, ConfirmButton, Empty, Panel, SearchInput, SelectFilter } from "./ui";

const statusTone: Record<CommentStatus, "green" | "amber" | "red"> = {
  APPROVED: "green",
  PENDING: "amber",
  DELETED: "red"
};

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
              <Badge tone={statusTone[item.status]}>{item.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            <p className="mt-2 text-xs text-slate-500">{item.article?.title ?? "Maqola topilmadi"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.status !== "APPROVED" && (
                <Button variant="primary" size="sm" icon={<Check size={15} />} onClick={() => onStatus(item.id, "APPROVED")}>
                  Tasdiqlash
                </Button>
              )}
              {item.status !== "DELETED" && (
                <ConfirmButton label="O'chirish" confirmLabel="Ha, o'chirish" icon={<Trash2 size={14} />} onConfirm={() => onStatus(item.id, "DELETED")} />
              )}
            </div>
          </div>
        ))}
        {!filtered.length && <Empty text="Moderatsiya qilinadigan izoh yo'q" />}
      </div>
    </Panel>
  );
}
