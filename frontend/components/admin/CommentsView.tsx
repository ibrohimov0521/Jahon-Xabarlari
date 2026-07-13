"use client";

import { Check, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COMMENT_STATUSES, type CommentItem, type CommentStatus } from "./types";
import { Badge, Button, ConfirmButton, Empty, Pagination, Panel, SearchInput, SelectFilter } from "./ui";

const statusTone: Record<CommentStatus, "green" | "amber" | "red"> = {
  APPROVED: "green",
  PENDING: "amber",
  DELETED: "red"
};

export function CommentsView({ comments, onStatus, page, pages, onPageChange, onFiltersChange }: {
  comments: CommentItem[];
  onStatus: (id: string, status: CommentStatus) => void;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  onFiltersChange: (search: string, status: CommentStatus | "") => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CommentStatus | "">("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  function changeSearch(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => onFiltersChange(value, status), 300);
  }

  function changeStatus(value: CommentStatus | "") {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setStatus(value);
    onFiltersChange(search, value);
  }

  return (
    <Panel
      title="Izohlar moderatsiyasi"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={changeSearch} placeholder="Ism yoki matn bo'yicha qidirish..." />
          <SelectFilter value={status} onChange={changeStatus} options={COMMENT_STATUSES} allLabel="Barcha statuslar" />
        </div>
      }
    >
      <div className="space-y-3">
        {comments.map((item) => (
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
        {!comments.length && <Empty text="Moderatsiya qilinadigan izoh yo'q" />}
      </div>
      <Pagination page={page} pages={pages} onChange={onPageChange} />
    </Panel>
  );
}
