"use client";

import {
  BarChart3,
  FilePlus2,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Newspaper,
  RefreshCcw,
  Tags,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { AdsView } from "../../components/admin/AdsView";
import { ArticleEditor } from "../../components/admin/ArticleEditor";
import { ArticlePreview } from "../../components/admin/ArticlePreview";
import { ArticlesView, fetchArticles } from "../../components/admin/ArticlesView";
import { AuditLogView } from "../../components/admin/AuditLogView";
import { CategoriesView } from "../../components/admin/CategoriesView";
import { CommentsView } from "../../components/admin/CommentsView";
import { Dashboard } from "../../components/admin/Dashboard";
import type { Article, ArticleFormState, ArticleStatus, AdItem, Category, CommentItem, CommentStatus, Stats } from "../../components/admin/types";
import { ErrorBanner, LoadingBlock, SuccessBanner } from "../../components/admin/ui";
import {
  AdminApiError,
  adminRequest,
  API_URL,
  getStoredToken,
  getStoredUser,
  login as apiLogin,
  logout as apiLogout,
  onAuthExpired,
  type AuthUser
} from "../../lib/admin-api";
import { SITE_LOGO, SITE_NAME } from "../../lib/site";

type View = "dashboard" | "articles" | "new" | "edit" | "preview" | "categories" | "ads" | "comments" | "stats" | "auditlog";

const menu: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "articles", label: "Yangiliklar", icon: Newspaper },
  { id: "new", label: "Yangi maqola", icon: FilePlus2 },
  { id: "categories", label: "Kategoriyalar", icon: Tags },
  { id: "ads", label: "Reklama", icon: Megaphone },
  { id: "comments", label: "Izohlar", icon: MessageCircle },
  { id: "stats", label: "Statistika", icon: BarChart3 },
  { id: "auditlog", label: "Audit log", icon: History }
];

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [stats, setStats] = useState<Stats | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [trashed, setTrashed] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [previewForm, setPreviewForm] = useState<ArticleFormState | null>(null);
  const [previewReturnView, setPreviewReturnView] = useState<View>("new");

  const currentTitle = menu.find((item) => item.id === view)?.label ?? (view === "edit" ? "Maqolani tahrirlash" : view === "preview" ? "Ko'rib chiqish" : "Admin");

  useEffect(() => {
    setToken(getStoredToken());
    setUser(getStoredUser());
    return onAuthExpired(() => {
      setToken("");
      setUser(null);
      setSessionNotice("Sessiya muddati tugadi, qaytadan kiring.");
    });
  }, []);

  async function loadCategories() {
    const data = await adminRequest<Category[]>("/categories");
    setCategories(data);
  }

  async function loadArticles(nextTrashed = trashed) {
    const data = await fetchArticles(nextTrashed);
    setArticles(data.items);
  }

  async function loadComments() {
    const data = await adminRequest<{ items: CommentItem[] }>("/admin/comments");
    setComments(data.items);
  }

  async function loadAds() {
    const data = await adminRequest<{ items: AdItem[] }>("/admin/advertisements");
    setAds(data.items);
  }

  async function loadDashboard() {
    const data = await adminRequest<Stats>("/admin/dashboard/stats");
    setStats(data);
  }

  async function refreshAll(nextView: View = view) {
    if (!getStoredToken()) return;
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadDashboard(), loadCategories()]);
      if (["articles", "dashboard", "stats", "new", "edit"].includes(nextView)) await loadArticles();
      if (nextView === "comments") await loadComments();
      if (nextView === "ads") await loadAds();
    } catch (err) {
      if (!(err instanceof AdminApiError && err.status === 401)) {
        setError(err instanceof Error ? err.message : "Ma'lumot yuklanmadi");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) refreshAll(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      const loggedInUser = await apiLogin(loginForm.email, loginForm.password);
      setUser(loggedInUser);
      setToken(getStoredToken());
      setSessionNotice("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login bajarilmadi");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    await apiLogout();
    setToken("");
    setUser(null);
    setStats(null);
    setArticles([]);
    setComments([]);
    setAds([]);
  }

  async function selectView(nextView: View) {
    setView(nextView);
    setMobileMenuOpen(false);
    if (nextView === "new") setEditingArticleId(null);
    await refreshAll(nextView);
  }

  function flash(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(""), 4000);
  }

  async function withErrorHandling(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Amal bajarilmadi");
    }
  }

  async function changeArticleStatus(id: string, status: ArticleStatus) {
    await withErrorHandling(async () => {
      await adminRequest(`/admin/articles/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      flash(`Maqola statusi ${status} qilindi`);
      await loadArticles();
    });
  }

  async function trashArticle(id: string) {
    await withErrorHandling(async () => {
      await adminRequest(`/admin/articles/${id}`, { method: "DELETE" });
      flash("Maqola trashga yuborildi");
      await loadArticles();
    });
  }

  async function restoreArticle(id: string) {
    await withErrorHandling(async () => {
      await adminRequest(`/admin/articles/${id}/restore`, { method: "PATCH" });
      flash("Maqola tiklandi");
      await loadArticles();
    });
  }

  async function permanentDelete(id: string) {
    await withErrorHandling(async () => {
      await adminRequest(`/admin/articles/${id}/permanent`, { method: "DELETE" });
      flash("Maqola butunlay o'chirildi");
      await loadArticles();
    });
  }

  async function bulkTrash(ids: string[]) {
    await withErrorHandling(async () => {
      await adminRequest("/admin/articles/bulk-trash", { method: "POST", body: JSON.stringify({ ids }) });
      flash(`${ids.length} ta maqola trashga yuborildi`);
      await loadArticles();
    });
  }

  async function bulkRestore(ids: string[]) {
    await withErrorHandling(async () => {
      await adminRequest("/admin/articles/bulk-restore", { method: "POST", body: JSON.stringify({ ids }) });
      flash(`${ids.length} ta maqola tiklandi`);
      await loadArticles();
    });
  }

  async function regenerateTranslation(id: string, lang: string) {
    await withErrorHandling(async () => {
      await adminRequest(`/admin/articles/${id}/translations/${lang}/regenerate`, { method: "POST" });
      flash(`${lang.toUpperCase()} tarjima qayta so'raldi`);
      await loadArticles();
    });
  }

  async function changeCommentStatus(id: string, status: CommentStatus) {
    await withErrorHandling(async () => {
      await adminRequest(`/admin/comments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      flash("Izoh holati yangilandi");
      await loadComments();
    });
  }

  function openEditor(id: string) {
    setEditingArticleId(id);
    setView("edit");
  }

  function openPreviewFromArticle(article: Article) {
    setPreviewForm({
      title: article.title,
      summary: article.summary,
      content: article.content,
      mainImage: article.mainImage ?? "",
      categoryId: article.categoryId ?? "",
      extraCategoryIds: article.extraCategoryIds ?? [],
      status: article.status,
      seoTitle: article.seoTitle ?? "",
      seoDescription: article.seoDescription ?? "",
      isBreaking: article.isBreaking,
      isFeatured: article.isFeatured,
      isEditorChoice: article.isEditorChoice,
      showOnHome: article.showOnHome,
      showInSlider: article.showInSlider,
      showInSidebar: article.showInSidebar,
      showInLatest: article.showInLatest,
      showInPopular: article.showInPopular
    });
    setPreviewReturnView(view === "edit" ? "edit" : "articles");
    setView("preview");
  }

  function openPreviewFromForm(form: ArticleFormState) {
    setPreviewForm(form);
    setPreviewReturnView(editingArticleId ? "edit" : "new");
    setView("preview");
  }

  if (!token || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4 text-ink">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 shadow-xl">
          <div className="mb-7">
            <Image src={SITE_LOGO} alt={SITE_NAME} width={76} height={76} priority className="h-16 w-16 rounded-md object-cover" />
            <h1 className="mt-2 text-3xl font-black">Admin panel</h1>
            <p className="mt-2 text-sm text-slate-500">Backend API orqali real ma&apos;lumotlarni boshqarish uchun kiring.</p>
          </div>
          {sessionNotice && <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{sessionNotice}</div>}
          <label className="block text-sm font-bold">Email</label>
          <input
            className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
            type="email"
            required
          />
          <label className="mt-4 block text-sm font-bold">Parol</label>
          <input
            className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            type="password"
            required
          />
          <ErrorBanner message={loginError} />
          <button disabled={loginBusy} className="mt-6 w-full rounded-md bg-brand px-4 py-3 font-black text-white transition hover:bg-blue-700 disabled:opacity-60">
            {loginBusy ? "Tekshirilmoqda..." : "Kirish"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-ink lg:flex">
      {mobileMenuOpen && <button aria-label="Menyuni yopish" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-ink p-6 text-white transition-transform duration-200 lg:static lg:min-h-screen lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <Image src={SITE_LOGO} alt={SITE_NAME} width={116} height={58} priority className="h-14 w-auto rounded-md object-contain" />
          <div className="flex items-center gap-1">
            <button onClick={handleLogout} className="rounded-md p-2 hover:bg-white/10" title="Chiqish">
              <LogOut size={20} />
            </button>
            <button onClick={() => setMobileMenuOpen(false)} className="rounded-md p-2 hover:bg-white/10 lg:hidden" title="Yopish">
              <X size={20} />
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-white/60">
          {user.name} · {user.role}
        </p>
        <nav className="mt-6 space-y-2">
          {menu.map(({ id, label, icon: Icon }) => (
            <button
              className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left font-semibold transition ${
                view === id || (id === "articles" && (view === "edit" || view === "preview")) ? "bg-brand text-white" : "hover:bg-white/10"
              }`}
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
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="rounded-md border border-slate-200 p-2 lg:hidden">
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-xl font-black sm:text-2xl">{currentTitle}</h2>
              <p className="hidden text-sm text-slate-500 sm:block">{API_URL}</p>
            </div>
          </div>
          <button onClick={() => refreshAll(view)} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 font-bold hover:border-brand">
            <RefreshCcw size={18} /> Yangilash
          </button>
        </header>

        <div className="p-4 sm:p-5">
          <ErrorBanner message={error} />
          <SuccessBanner message={message} />
          {loading && <div className="mb-4"><LoadingBlock /></div>}

          {view === "dashboard" && <Dashboard stats={stats} articles={articles} />}
          {view === "stats" && <Dashboard stats={stats} articles={articles} />}
          {view === "articles" && (
            <ArticlesView
              articles={articles}
              trashed={trashed}
              onTrashedChange={(next) => {
                setTrashed(next);
                loadArticles(next);
              }}
              onStatus={changeArticleStatus}
              onTrash={trashArticle}
              onRestore={restoreArticle}
              onPermanentDelete={permanentDelete}
              onBulkTrash={bulkTrash}
              onBulkRestore={bulkRestore}
              onEdit={openEditor}
              onPreview={openPreviewFromArticle}
              onRegenerateTranslation={regenerateTranslation}
            />
          )}
          {(view === "new" || view === "edit") && (
            <ArticleEditor
              articleId={view === "edit" ? editingArticleId : null}
              categories={categories}
              onPreview={openPreviewFromForm}
              onSaved={() => {
                flash(view === "edit" ? "Maqola yangilandi" : "Yangi maqola saqlandi");
                setView("articles");
                loadArticles();
              }}
            />
          )}
          {view === "preview" && previewForm && (
            <ArticlePreview
              form={previewForm}
              categories={categories}
              onBack={() => setView(previewReturnView)}
            />
          )}
          {view === "categories" && <CategoriesView categories={categories} onChanged={loadCategories} />}
          {view === "comments" && <CommentsView comments={comments} onStatus={changeCommentStatus} />}
          {view === "ads" && <AdsView ads={ads} onChanged={loadAds} />}
          {view === "auditlog" && <AuditLogView />}
        </div>
      </section>
    </main>
  );
}
