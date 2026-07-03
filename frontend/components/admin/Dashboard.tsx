"use client";

import { BarChart3, BookOpen, FileText, Newspaper, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Article, Stats } from "./types";
import { Empty, Panel } from "./ui";

export function Dashboard({ stats, articles }: { stats: Stats | null; articles: Article[] }) {
  const cards: { label: string; value: number; icon: LucideIcon }[] = [
    { label: "Jami yangiliklar", value: stats?.totalArticles ?? 0, icon: Newspaper },
    { label: "Bugun qo'shildi", value: stats?.todayArticles ?? 0, icon: FileText },
    { label: "Jami ko'rishlar", value: stats?.totalViews ?? 0, icon: BarChart3 },
    { label: "Review", value: stats?.reviewArticles ?? 0, icon: ShieldCheck },
    { label: "Draft", value: stats?.draftArticles ?? 0, icon: BookOpen },
    { label: "Foydalanuvchilar", value: stats?.users ?? 0, icon: Users }
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Icon className="text-brand" />
            <p className="mt-5 text-sm text-slate-500">{label}</p>
            <strong className="text-3xl">{value.toLocaleString("uz-UZ")}</strong>
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Eng ko'p ko'rilganlar">
          <Rows items={stats?.popular ?? []} empty="Hozircha mashhur maqola yo'q" />
        </Panel>
        <Panel title="So'nggi yangiliklar">
          <Rows items={articles.slice(0, 5)} empty="Bazadagi yangiliklar bo'sh" />
        </Panel>
      </div>
    </div>
  );
}

function Rows({ items, empty }: { items: { id: string; title: string; viewsCount?: number; status?: string }[]; empty: string }) {
  if (!items.length) return <Empty text={empty} />;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-4 py-3" key={item.id}>
          <span className="font-bold">{item.title}</span>
          <span className="text-sm text-slate-500">{item.status ?? `${item.viewsCount ?? 0} ko'rish`}</span>
        </div>
      ))}
    </div>
  );
}
