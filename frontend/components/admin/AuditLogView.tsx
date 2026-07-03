"use client";

import { useEffect, useState } from "react";
import { adminRequest } from "../../lib/admin-api";
import type { AuditLogItem } from "./types";
import { Empty, ErrorBanner, LoadingBlock, Pagination, Panel, SearchInput } from "./ui";

export function AuditLogView() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [entityFilter, setEntityFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page) });
    if (entityFilter) query.set("entity", entityFilter);
    adminRequest<{ items: AuditLogItem[]; pages: number }>(`/admin/audit-logs?${query}`)
      .then((data) => {
        setItems(data.items);
        setPages(data.pages);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Audit log yuklanmadi"))
      .finally(() => setLoading(false));
  }, [page, entityFilter]);

  return (
    <Panel title="Audit log" actions={<SearchInput value={entityFilter} onChange={(value) => { setEntityFilter(value); setPage(1); }} placeholder="Entity bo'yicha (Article, Category...)" />}>
      <ErrorBanner message={error} />
      {loading && <LoadingBlock />}
      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3">Vaqt</th>
                <th>Foydalanuvchi</th>
                <th>Amal</th>
                <th>Entity</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-t border-slate-200" key={item.id}>
                  <td className="p-3 whitespace-nowrap">{new Date(item.createdAt).toLocaleString("uz-UZ")}</td>
                  <td>{item.user?.name ?? "—"}</td>
                  <td className="font-bold">{item.action}</td>
                  <td>
                    {item.entity}
                    {item.entityId ? ` #${item.entityId.slice(0, 6)}` : ""}
                  </td>
                  <td className="text-slate-500">{item.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <Empty text="Audit yozuvlari yo'q" />}
          <Pagination page={page} pages={pages} onChange={setPage} />
        </div>
      )}
    </Panel>
  );
}
