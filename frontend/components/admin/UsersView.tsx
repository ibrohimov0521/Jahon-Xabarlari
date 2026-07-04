"use client";

import type { UserItem } from "./types";
import { Badge, Empty, Panel } from "./ui";

export function UsersView({ users }: { users: UserItem[] }) {
  return (
    <Panel title="Foydalanuvchilar">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3">Ism</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Telegram ID</th>
              <th>Qo'shilgan</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr className="border-t border-slate-200" key={item.id}>
                <td className="p-3 font-bold">{item.name}</td>
                <td>{item.email}</td>
                <td>
                  <Badge>{item.role.name}</Badge>
                </td>
                <td>{item.telegramId ?? "-"}</td>
                <td>{new Date(item.createdAt).toLocaleDateString("uz-UZ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && <Empty text="Foydalanuvchilar topilmadi" />}
      </div>
    </Panel>
  );
}
