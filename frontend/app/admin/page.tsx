"use client";

import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  FilePlus2,
  FileText,
  Image,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageCircle,
  Newspaper,
  PenLine,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Tags,
  Trash2,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://backend-production-8124.up.railway.app/api";

type View =
  | "dashboard"
  | "articles"
  | "new"
  | "categories"
  | "authors"
  | "media"
  | "ads"
  | "comments"
  | "stats"
  | "settings"
  | "users";

type AuthUser = { id: string; name: string; email?: string; role: string };
type Category = { id: string; name: string; slug: string };
type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  status: "DRAFT" | "REVIEW" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED";
  viewsCount: number;
  isBreaking: boolean;
  isFeatured: boolean;
  isEditorChoice: boolean;
  showOnHome: boolean;
  updatedAt: string;
  category?: { name: string; slug: string };
  author?: { name: string };
};
type Stats = {
  totalArticles: number;
  todayArticles: number;
  draftArticles: number;
  reviewArticles: number;
  users: number;
  totalViews: number;
  popular: Pick<Article, "id" | "title" | "viewsCount">[];
};
type CommentItem = { id: string; name: string; body: string; status: "PENDING" | "APPROVED" | "DELETED"; createdAt: string; article?: { title: string } };
type AdItem = { id: string; title: string; placement: string; status: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED"; updatedAt: string };

const menu: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "articles", label: "Yangiliklar", icon: Newspaper },
  { id: "new", label: "Yangi maqola", icon: FilePlus2 },
  { id: "categories", label: "Kategoriyalar", icon: Tags },
  { id: "authors", label: "Mualliflar", icon: PenLine },
  { id: "media", label: "Media", icon: Image },
  { id: "ads", label: "Reklama", icon: Megaphone },
  { id: "comments", label: "Izohlar", icon: MessageCircle },
  { id: "stats", label: "Statistika", icon: BarChart3 },
  { id: "settings", label: "Sozlamalar", icon: Settings },
  { id: "users", label: "Foydalanuvchilar", icon: Users }
];

const emptyArticle = {
  title: "",
  summary: "",
  content: "",
  mainImage: "",
  categoryId: "",
  status: "DRAFT",
  isBreaking: false,
  isFeatured: false,
  isEditorChoice: false,
  showOnHome: true,
  showInSlider: false,
  showInSidebar: false,
  showInLatest: true,
  showInPopular: false
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [login, setLogin] = useState({ email: "", password: "" });
  const [stats, setStats] = useState<Stats | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [articleForm, setArticleForm] = useState(emptyArticle);
  const currentTitle = menu.find((item) => item.id === view)?.label ?? "Admin";

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }),
    [token]
  );

  async function request<T>(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "So'rov bajarilmadi");
    return data as T;
  }

  async function loadDashboard() {
    const data = await request<Stats>("/admin/dashboard/stats");
    setStats(data);
  }

  async function loadArticles() {
    const data = await request<{ items: Article[] }>("/admin/articles");
    setArticles(data.items);
  }

  async function loadCategories() {
    const data = await request<Category[]>("/categories");
    setCategories(data);
    setArticleForm((form) => ({ ...form, categoryId: form.categoryId || data[0]?.id || "" }));
  }

  async function loadComments() {
    const data = await request<{ items: CommentItem[] }>("/admin/comments");
    setComments(data.items);
  }

  async function loadAds() {
    const data = await request<{ items: AdItem[] }>("/admin/advertisements");
    setAds(data.items);
  }

  async function refreshAll(nextView = view) {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      await Promise.all([loadDashboard(), loadCategories()]);
      if (["articles", "dashboard", "stats"].includes(nextView)) await loadArticles();
      if (nextView === "comments") await loadComments();
      if (nextView === "ads") await loadAds();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ma'lumot yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem("jh_admin_token");
    const savedUser = localStorage.getItem("jh_admin_user");
    if (savedToken) setToken(savedToken);
    if (savedUser) setUser(JSON.parse(savedUser) as AuthUser);
  }, []);

  useEffect(() => {
    if (token) refreshAll(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const data = await request<{ user: AuthUser; accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(login)
      });
      localStorage.setItem("jh_admin_token", data.accessToken);
      localStorage.setItem("jh_admin_user", JSON.stringify(data.user));
      setToken(data.accessToken);
      setUser(data.user);
      setMessage("Admin panelga kirdingiz");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login bajarilmadi");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("jh_admin_token");
    localStorage.removeItem("jh_admin_user");
    setToken("");
    setUser(null);
    setStats(null);
    setArticles([]);
  }

  async function selectView(nextView: View) {
    setView(nextView);
    await refreshAll(nextView);
  }

  async function changeArticleStatus(id: string, status: Article["status"]) {
    await request(`/admin/articles/${id}/status`, { method: "PATCH", headers: authHeaders, body: JSON.stringify({ status }) });
    setMessage(`Maqola statusi ${status} qilindi`);
    await refreshAll("articles");
  }

  async function trashArticle(id: string) {
    if (!confirm("Maqolani trashga yuborishni tasdiqlaysizmi?")) return;
    await request(`/admin/articles/${id}`, { method: "DELETE", headers: authHeaders });
    setMessage("Maqola trashga yuborildi");
    await refreshAll("articles");
  }

  async function changeCommentStatus(id: string, status: CommentItem["status"]) {
    await request(`/admin/comments/${id}/status`, { method: "PATCH", headers: authHeaders, body: JSON.stringify({ status }) });
    setMessage("Izoh holati yangilandi");
    await loadComments();
  }

  async function changeAdStatus(id: string, status: AdItem["status"]) {
    await request(`/admin/advertisements/${id}/status`, { method: "PATCH", headers: authHeaders, body: JSON.stringify({ status }) });
    setMessage("Reklama holati yangilandi");
    await loadAds();
  }

  async function createArticle(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await request("/admin/articles", {
        method: "POST",
        body: JSON.stringify(articleForm)
      });
      setArticleForm({ ...emptyArticle, categoryId: categories[0]?.id || "" });
      setMessage("Yangi maqola saqlandi");
      setView("articles");
      await refreshAll("articles");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Maqola saqlanmadi");
    } finally {
      setLoading(false);
    }
  }

  if (!token || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4 text-ink">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 shadow-xl">
          <div className="mb-7">
            <p className="text-sm font-bold uppercase text-brand">Jahon Xabarlari</p>
            <h1 className="mt-2 text-3xl font-black">Admin panel</h1>
            <p className="mt-2 text-sm text-slate-500">Backend API orqali real ma'lumotlarni boshqarish uchun kiring.</p>
          </div>
          <label className="block text-sm font-bold">Email</label>
          <input className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} type="email" required />
          <label className="mt-4 block text-sm font-bold">Parol</label>
          <input className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} type="password" required />
          {message && <p className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</p>}
          <button disabled={loading} className="mt-6 w-full rounded-md bg-brand px-4 py-3 font-black text-white transition hover:bg-blue-700 disabled:opacity-60">
            {loading ? "Tekshirilmoqda..." : "Kirish"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-ink lg:flex">
      <aside className="bg-ink p-4 text-white lg:min-h-screen lg:w-72 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">Jahon <span className="text-brand">Admin</span></h1>
          <button onClick={logout} className="rounded-md p-2 hover:bg-white/10" title="Chiqish"><LogOut size={20} /></button>
        </div>
        <p className="mt-2 text-sm text-white/60">{user.name} · {user.role}</p>
        <nav className="mt-6 grid gap-2 sm:grid-cols-2 lg:block lg:space-y-2">
          {menu.map(({ id, label, icon: Icon }) => (
            <button
              className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left font-semibold transition ${view === id ? "bg-brand text-white" : "hover:bg-white/10"}`}
              key={id}
              onClick={() => selectView(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="flex-1">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-2xl font-black">{currentTitle}</h2>
            <p className="text-sm text-slate-500">{API_URL}</p>
          </div>
          <button onClick={() => refreshAll(view)} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 font-bold hover:border-brand">
            <RefreshCcw size={18} /> Yangilash
          </button>
        </header>

        <div className="p-5">
          {message && <div className="mb-4 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">{message}</div>}
          {loading && <div className="mb-4 rounded-md bg-blue-50 px-4 py-3 text-sm font-bold text-brand">Yuklanmoqda...</div>}

          {(view === "dashboard" || view === "stats") && <Dashboard stats={stats} articles={articles} />}
          {view === "articles" && <Articles articles={articles} onStatus={changeArticleStatus} onTrash={trashArticle} />}
          {view === "new" && (
            <ArticleForm
              form={articleForm}
              categories={categories}
              setForm={setArticleForm}
              onSubmit={createArticle}
            />
          )}
          {view === "categories" && <CategoryList categories={categories} />}
          {view === "comments" && <Comments comments={comments} onStatus={changeCommentStatus} />}
          {view === "ads" && <Ads ads={ads} onStatus={changeAdStatus} />}
          {["authors", "media", "settings", "users"].includes(view) && <ComingSoon view={currentTitle} />}
        </div>
      </section>
    </main>
  );
}

function Dashboard({ stats, articles }: { stats: Stats | null; articles: Article[] }) {
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
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Icon className="text-brand" />
            <p className="mt-5 text-sm text-slate-500">{label}</p>
            <strong className="text-3xl">{value}</strong>
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

function Articles({ articles, onStatus, onTrash }: { articles: Article[]; onStatus: (id: string, status: Article["status"]) => void; onTrash: (id: string) => void }) {
  return (
    <Panel title="Yangiliklar jadvali">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr><th className="p-3">Sarlavha</th><th>Kategoriya</th><th>Status</th><th>Ko'rish</th><th>Belgilar</th><th>Amal</th></tr>
          </thead>
          <tbody>
            {articles.map((item) => (
              <tr className="border-t border-slate-200" key={item.id}>
                <td className="p-3 font-bold">{item.title}</td>
                <td>{item.category?.name ?? "-"}</td>
                <td><Badge>{item.status}</Badge></td>
                <td>{item.viewsCount}</td>
                <td className="text-slate-500">{[item.isBreaking && "Breaking", item.isFeatured && "Featured", item.isEditorChoice && "Editor"].filter(Boolean).join(", ") || "-"}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {(["PUBLISHED", "REVIEW", "DRAFT", "ARCHIVED"] as const).map((status) => (
                      <button key={status} onClick={() => onStatus(item.id, status)} className="rounded-md border border-slate-200 px-2 py-1 font-bold hover:border-brand">{status}</button>
                    ))}
                    <button onClick={() => onTrash(item.id)} className="rounded-md bg-red-600 px-2 py-1 font-bold text-white"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!articles.length && <Empty text="Bazadagi yangiliklar bo'sh. Yangi maqola qo'shishingiz mumkin." />}
      </div>
    </Panel>
  );
}

function ArticleForm({ form, categories, setForm, onSubmit }: { form: typeof emptyArticle; categories: Category[]; setForm: (form: typeof emptyArticle) => void; onSubmit: (event: FormEvent) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel title="Yangi maqola">
        <div className="grid gap-4">
          <Input label="Sarlavha" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <Input label="Qisqa tavsif" value={form.summary} onChange={(value) => setForm({ ...form, summary: value })} />
          <label className="text-sm font-bold">Asosiy matn</label>
          <textarea className="min-h-52 rounded-md border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
          <Input label="Rasm URL" value={form.mainImage} onChange={(value) => setForm({ ...form, mainImage: value })} />
        </div>
      </Panel>
      <Panel title="Ko'rinishi">
        <div className="grid gap-4">
          <label className="text-sm font-bold">Kategoriya</label>
          <select className="rounded-md border border-slate-200 bg-white px-4 py-3" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <label className="text-sm font-bold">Status</label>
          <select className="rounded-md border border-slate-200 bg-white px-4 py-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"].map((status) => <option key={status}>{status}</option>)}
          </select>
          {[
            ["isBreaking", "Breaking news"],
            ["isFeatured", "Featured"],
            ["isEditorChoice", "Editor choice"],
            ["showOnHome", "Bosh sahifada"],
            ["showInSlider", "Sliderda"],
            ["showInSidebar", "Sidebar"],
            ["showInLatest", "So'nggi yangiliklar"],
            ["showInPopular", "Popular"]
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 font-semibold">
              {label}
              <input type="checkbox" checked={Boolean(form[key as keyof typeof form])} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
            </label>
          ))}
          <button className="rounded-md bg-brand px-4 py-3 font-black text-white hover:bg-blue-700">Maqolani saqlash</button>
        </div>
      </Panel>
    </form>
  );
}

function CategoryList({ categories }: { categories: Category[] }) {
  return (
    <Panel title="Kategoriyalar">
      <div className="grid gap-3 md:grid-cols-3">
        {categories.map((category) => (
          <div key={category.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <strong>{category.name}</strong>
            <p className="text-sm text-slate-500">/{category.slug}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Comments({ comments, onStatus }: { comments: CommentItem[]; onStatus: (id: string, status: CommentItem["status"]) => void }) {
  return (
    <Panel title="Izohlar moderatsiyasi">
      <div className="space-y-3">
        {comments.map((item) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>{item.name}</strong>
              <Badge>{item.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            <p className="mt-2 text-xs text-slate-500">{item.article?.title ?? "Maqola topilmadi"}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onStatus(item.id, "APPROVED")} className="rounded-md bg-green-600 px-3 py-2 font-bold text-white">Tasdiqlash</button>
              <button onClick={() => onStatus(item.id, "DELETED")} className="rounded-md bg-red-600 px-3 py-2 font-bold text-white">O'chirish</button>
            </div>
          </div>
        ))}
        {!comments.length && <Empty text="Moderatsiya qilinadigan izoh yo'q" />}
      </div>
    </Panel>
  );
}

function Ads({ ads, onStatus }: { ads: AdItem[]; onStatus: (id: string, status: AdItem["status"]) => void }) {
  return (
    <Panel title="Reklama">
      <div className="space-y-3">
        {ads.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-4">
            <div>
              <strong>{item.title}</strong>
              <p className="text-sm text-slate-500">{item.placement} · {item.status}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["ACTIVE", "PAUSED", "DRAFT", "EXPIRED"] as const).map((status) => (
                <button key={status} onClick={() => onStatus(item.id, status)} className="rounded-md border border-slate-200 px-3 py-2 font-bold hover:border-brand">{status}</button>
              ))}
            </div>
          </div>
        ))}
        {!ads.length && <Empty text="Reklama yozuvlari yo'q" />}
      </div>
    </Panel>
  );
}

function ComingSoon({ view }: { view: string }) {
  return (
    <Panel title={view}>
      <div className="flex items-start gap-3 rounded-md bg-slate-50 p-4">
        <CheckCircle2 className="text-brand" />
        <p className="text-slate-600">Bu bo'lim endi bosilganda ochiladi. Keyingi bosqichda unga alohida CRUD funksiyalari qo'shiladi.</p>
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-xl font-black">{title}</h3>
      {children}
    </section>
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

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <input className="rounded-md border border-slate-200 bg-white px-4 py-3 font-normal outline-none focus:border-brand" value={value} onChange={(e) => onChange(e.target.value)} required />
    </label>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-brand">{children}</span>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</p>;
}
