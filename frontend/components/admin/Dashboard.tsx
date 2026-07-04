"use client";

import { BarChart3, BookOpen, FileText, Newspaper, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Article, Stats } from "./types";
import { Empty, Panel } from "./ui";

type DashboardAction = "articles" | "today" | "stats" | "review" | "draft" | "users";

export function Dashboard({ stats, articles, onAction }: { stats: Stats | null; articles: Article[]; onAction: (action: DashboardAction) => void }) {
  const cards: { label: string; value: number; icon: LucideIcon; action: DashboardAction }[] = [
    { label: "Jami yangiliklar", value: stats?.totalArticles ?? 0, icon: Newspaper, action: "articles" },
    { label: "Bugun qo'shildi", value: stats?.todayArticles ?? 0, icon: FileText, action: "today" },
    { label: "Jami ko'rishlar", value: stats?.totalViews ?? 0, icon: BarChart3, action: "stats" },
    { label: "Review", value: stats?.reviewArticles ?? 0, icon: ShieldCheck, action: "review" },
    { label: "Draft", value: stats?.draftArticles ?? 0, icon: BookOpen, action: "draft" },
    { label: "Foydalanuvchilar", value: stats?.users ?? 0, icon: Users, action: "users" }
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ label, value, icon: Icon, action }) => (
          <button
            key={label}
            onClick={() => onAction(action)}
            className="rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <Icon className="text-brand" />
            <p className="mt-5 text-sm text-slate-500">{label}</p>
            <strong className="text-3xl">{value.toLocaleString("uz-UZ")}</strong>
          </button>
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
