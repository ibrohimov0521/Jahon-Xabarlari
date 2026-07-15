"use client";

import {
  Bot,
  FilePlus2,
  Flag,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Moon,
  Newspaper,
  RefreshCcw,
  ShieldCheck,
  Sun,
  Tags,
  Users,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AdsView } from "../../components/admin/AdsView";
import { AggregatorView } from "../../components/admin/AggregatorView";
import { ArticleEditor } from "../../components/admin/ArticleEditor";
import { ArticlePreview } from "../../components/admin/ArticlePreview";
import { ArticlesView, fetchArticles } from "../../components/admin/ArticlesView";
import { AuditLogView } from "../../components/admin/AuditLogView";
import { CategoriesView } from "../../components/admin/CategoriesView";
import { CommentsView } from "../../components/admin/CommentsView";
import { Dashboard } from "../../components/admin/Dashboard";
import { ReportsView } from "../../components/admin/ReportsView";
import { SecurityView } from "../../components/admin/SecurityView";
import { UsersView } from "../../components/admin/UsersView";
import type { Article, ArticleFormState, ArticleStatus, AdItem, Category, CommentItem, CommentStatus, Stats, UserItem } from "../../components/admin/types";
import { Button, ErrorBanner, IconButton, Input, LoadingBlock, Toast } from "../../components/admin/ui";
import {
  AdminApiError,
  adminRequest,
  getStoredToken,
  login as apiLogin,
  logout as apiLogout,
  onAuthExpired,
  restoreSession,
  type AuthUser
} from "../../lib/admin-api";
import { SITE_LOGO, SITE_NAME } from "../../lib/site";
import { useUi } from "../../lib/ui-context";

type View = "dashboard" | "articles" | "new" | "edit" | "preview" | "categories" | "ads" | "comments" | "reports" | "stats" | "users" | "auditlog" | "aggregator" | "security";

const menu: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "articles", label: "Yangiliklar", icon: Newspaper },
  { id: "new", label: "Yangi maqola", icon: FilePlus2 },
  { id: "categories", label: "Kategoriyalar", icon: Tags },
  { id: "ads", label: "Reklama", icon: Megaphone },
  { id: "comments", label: "Izohlar", icon: MessageCircle },
  { id: "reports", label: "Xato xabarlari", icon: Flag },
  { id: "users", label: "Foydalanuvchilar", icon: Users },
  { id: "auditlog", label: "Audit log", icon: History },
  { id: "aggregator", label: "Agregator", icon: Bot },
  { id: "security", label: "Xavfsizlik", icon: ShieldCheck }
];

export default function AdminPage() {
  const { theme, toggleTheme } = useUi();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "", otp: "" });
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [stats, setStats] = useState<Stats | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [trashed, setTrashed] = useState(false);
  const [articlePage, setArticlePage] = useState(1);
  const [articlePages, setArticlePages] = useState(1);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articleSearch, setArticleSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentPages, setCommentPages] = useState(1);
  const [commentSearch, setCommentSearch] = useState("");
  const [commentStatus, setCommentStatus] = useState<CommentStatus | "">("");
  const [ads, setAds] = useState<AdItem[]>([]);
  const [adPage, setAdPage] = useState(1);
  const [adPages, setAdPages] = useState(1);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [previewForm, setPreviewForm] = useState<ArticleFormState | null>(null);
  const [previewReturnView, setPreviewReturnView] = useState<View>("new");
  const [articleStatusFilter, setArticleStatusFilter] = useState<ArticleStatus | "">("");
  const [articleOnlyToday, setArticleOnlyToday] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const articleLoadSequence = useRef(0);
  const commentLoadSequence = useRef(0);
  const adLoadSequence = useRef(0);
  const userLoadSequence = useRef(0);

  const currentTitle = menu.find((item) => item.id === view)?.label ?? (view === "edit" ? "Maqolani tahrirlash" : view === "preview" ? "Ko'rib chiqish" : "Admin");

  useEffect(() => {
    let active = true;
    void restoreSession().then((restoredUser) => {
      if (!active) return;
      setUser(restoredUser);
      setToken(getStoredToken());
      setAuthReady(true);
    });
    const unsubscribe = onAuthExpired(() => {
      setToken("");
      setUser(null);
      setSessionNotice("Sessiya muddati tugadi, qaytadan kiring.");
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function loadCategories() {
    const data = await adminRequest<Category[]>("/categories");
    setCategories(data);
  }

  async function loadArticles(
    nextTrashed = trashed,
    nextPage = articlePage,
    nextSearch = articleSearch,
    nextStatus = articleStatusFilter,
    nextOnlyToday = articleOnlyToday
  ) {
    const requestId = ++articleLoadSequence.current;
    let data = await fetchArticles({ trashed: nextTrashed, page: nextPage, search: nextSearch, status: nextStatus, today: nextOnlyToday });
    if (data.pages > 0 && nextPage > data.pages) {
      data = await fetchArticles({ trashed: nextTrashed, page: data.pages, search: nextSearch, status: nextStatus, today: nextOnlyToday });
    }
    if (requestId !== articleLoadSequence.current) return;
    setArticles(data.items);
    setArticlePage(data.page || 1);
    setArticlePages(Math.max(data.pages, 1));
    setArticleTotal(data.total);
  }

  async function loadComments(nextPage = commentPage, nextSearch = commentSearch, nextStatus = commentStatus) {
    const requestId = ++commentLoadSequence.current;
    const query = new URLSearchParams({ page: String(nextPage), limit: "50" });
    if (nextSearch) query.set("search", nextSearch);
    if (nextStatus) query.set("status", nextStatus);
    let data = await adminRequest<{ items: CommentItem[]; page: number; pages: number }>(`/admin/comments?${query}`);
    if (data.pages > 0 && nextPage > data.pages) {
      query.set("page", String(data.pages));
      data = await adminRequest<{ items: CommentItem[]; page: number; pages: number }>(`/admin/comments?${query}`);
    }
    if (requestId !== commentLoadSequence.current) return;
    setComments(data.items);
    setCommentPage(data.page || 1);
    setCommentPages(Math.max(data.pages, 1));
  }

  async function loadAds(nextPage = adPage) {
    const requestId = ++adLoadSequence.current;
    let data = await adminRequest<{ items: AdItem[]; page: number; pages: number }>(`/admin/advertisements?page=${nextPage}&limit=30`);
    if (data.pages > 0 && nextPage > data.pages) {
      data = await adminRequest<{ items: AdItem[]; page: number; pages: number }>(`/admin/advertisements?page=${data.pages}&limit=30`);
    }
    if (requestId !== adLoadSequence.current) return;
    setAds(data.items);
    setAdPage(data.page || 1);
    setAdPages(Math.max(data.pages, 1));
  }

  async function loadUsers(nextPage = userPage) {
    const requestId = ++userLoadSequence.current;
    let data = await adminRequest<{ items: UserItem[]; page: number; pages: number }>(`/admin/users?page=${nextPage}&limit=50`);
    if (data.pages > 0 && nextPage > data.pages) {
      data = await adminRequest<{ items: UserItem[]; page: number; pages: number }>(`/admin/users?page=${data.pages}&limit=50`);
    }
    if (requestId !== userLoadSequence.current) return;
    setUsers(data.items);
    setUserPage(data.page || 1);
    setUserPages(Math.max(data.pages, 1));
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
      if (["dashboard", "stats", "new", "edit"].includes(nextView)) await loadArticles(false, 1, "", "", false);
      if (nextView === "articles") await loadArticles();
      if (nextView === "comments") await loadComments();
      if (nextView === "ads") await loadAds();
      if (nextView === "users") await loadUsers();
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
      const result = await apiLogin(loginForm.email, loginForm.password, twoFactorRequired ? loginForm.otp : undefined);
      if (result.requiresTwoFactor) {
        setTwoFactorRequired(true);
        return;
      }
      setUser(result.user);
      setToken(getStoredToken());
      setSessionNotice("");
      setTwoFactorRequired(false);
      setLoginForm((current) => ({ ...current, otp: "" }));
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
    setTwoFactorRequired(false);
    setLoginForm((current) => ({ ...current, otp: "" }));
  }

  async function selectView(nextView: View) {
    setView(nextView);
    if (nextView === "new") setEditingArticleId(null);
    if (nextView !== "articles") {
      setArticleStatusFilter("");
      setArticleOnlyToday(false);
    }
    await refreshAll(nextView);
  }

  async function openArticlesFromDashboard(status: ArticleStatus | "" = "", onlyToday = false) {
    setArticleStatusFilter(status);
    setArticleOnlyToday(onlyToday);
    setTrashed(false);
    setArticleSearch("");
    setArticlePage(1);
    setView("articles");
    await loadArticles(false, 1, "", status, onlyToday);
  }

  async function handleDashboardAction(action: "articles" | "today" | "stats" | "review" | "draft" | "users") {
    if (action === "articles") return openArticlesFromDashboard();
    if (action === "today") return openArticlesFromDashboard("", true);
    if (action === "review") return openArticlesFromDashboard("REVIEW");
    if (action === "draft") return openArticlesFromDashboard("DRAFT");
    if (action === "users") {
      setView("users");
      setArticleStatusFilter("");
      setArticleOnlyToday(false);
      await loadUsers(1);
      return;
    }
    setView("dashboard");
    await refreshAll("dashboard");
  }

  function flash(text: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setMessage(text);
    flashTimer.current = setTimeout(() => setMessage(""), 4000);
  }

  async function withErrorHandling(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Amal bajarilmadi");
    }
  }

  async function changeArticleStatus(id: string, status: ArticleStatus, scheduledAt?: string) {
    await withErrorHandling(async () => {
      await adminRequest(`/admin/articles/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, scheduledAt }) });
      flash(status === "SCHEDULED" ? "Maqola rejalashtirildi" : `Maqola statusi ${status} qilindi`);
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
      shortDescription: article.shortDescription ?? "",
      content: article.content,
      mainImage: article.mainImage ?? "",
      gallery: article.gallery ?? [],
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

  if (!authReady) {
    return <main className="admin-login-page"><LoadingBlock label="Sessiya tekshirilmoqda..." /></main>;
  }

  if (!token || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4 text-ink">
        <Button
          variant="secondary"
          onClick={toggleTheme}
          className="fixed right-5 top-5"
          icon={theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        >
          {theme === "dark" ? "Kunduz" : "Tun"}
        </Button>
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 shadow-xl">
          <div className="mb-7">
            <Image src={SITE_LOGO} alt={SITE_NAME} width={76} height={76} priority className="h-16 w-16 rounded-md object-cover" />
            <h1 className="mt-2 text-3xl font-black">Admin panel</h1>
            <p className="mt-2 text-sm text-slate-500">Backend API orqali real ma&apos;lumotlarni boshqarish uchun kiring.</p>
          </div>
          {sessionNotice && <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{sessionNotice}</div>}
          <div className="grid gap-4">
            <Input label="Email" type="email" value={loginForm.email} onChange={(email) => setLoginForm({ ...loginForm, email })} placeholder="admin@..." />
            <Input label="Parol" type="password" value={loginForm.password} onChange={(password) => setLoginForm({ ...loginForm, password })} placeholder="••••••••" />
            {twoFactorRequired && <Input label="Authenticator yoki tiklash kodi" value={loginForm.otp} onChange={(otp) => setLoginForm({ ...loginForm, otp })} placeholder="123456" />}
          </div>
          <ErrorBanner message={loginError} />
          <Button type="submit" size="lg" disabled={loginBusy} className="mt-6 w-full">
            {loginBusy ? "Tekshirilmoqda..." : twoFactorRequired ? "Kodni tasdiqlash" : "Kirish"}
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-ink lg:flex">
      <aside className="hidden w-72 shrink-0 bg-ink p-6 text-white lg:block lg:min-h-screen">
        <div className="flex items-center justify-between gap-3">
          <Image src={SITE_LOGO} alt={SITE_NAME} width={116} height={58} priority className="h-14 w-auto rounded-md object-contain" />
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="rounded-md p-2 hover:bg-white/10" title={theme === "dark" ? "Kunduzgi rejim" : "Tungi rejim"}>
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={handleLogout} className="rounded-md p-2 hover:bg-white/10" title="Chiqish">
              <LogOut size={20} />
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
            <Image src={SITE_LOGO} alt="" width={44} height={44} priority className="h-10 w-10 rounded-md object-contain lg:hidden" />
            <div>
              <h2 className="text-xl font-black sm:text-2xl">{currentTitle}</h2>
              <p className="hidden text-sm text-slate-500 sm:block">
                {user.name} · {user.role}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="hidden lg:inline-flex" onClick={() => refreshAll(view)} icon={<RefreshCcw size={18} />}>
              Yangilash
            </Button>
            <IconButton
              variant="secondary"
              className="lg:hidden"
              onClick={() => refreshAll(view)}
              icon={<RefreshCcw size={18} />}
              label="Yangilash"
            />
            <IconButton
              variant="secondary"
              className="lg:hidden"
              onClick={toggleTheme}
              icon={theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              label={theme === "dark" ? "Kunduzgi rejim" : "Tungi rejim"}
            />
          </div>
        </header>

        <div className="p-4 pb-24 sm:p-5 sm:pb-24 lg:pb-5">
          <ErrorBanner message={error} />
          <Toast message={message} onClose={() => setMessage("")} />
          {loading && <div className="mb-4"><LoadingBlock /></div>}

          {(view === "dashboard" || view === "stats") && <Dashboard stats={stats} articles={articles} onAction={handleDashboardAction} />}
          {view === "articles" && (
            <ArticlesView
              articles={articles}
              trashed={trashed}
              initialStatus={articleStatusFilter}
              onlyToday={articleOnlyToday}
              onTrashedChange={(next) => {
                const nextStatus = next ? "" : articleStatusFilter;
                const nextOnlyToday = next ? false : articleOnlyToday;
                setTrashed(next);
                setArticleStatusFilter(nextStatus);
                setArticleOnlyToday(nextOnlyToday);
                setArticlePage(1);
                void withErrorHandling(() => loadArticles(next, 1, articleSearch, nextStatus, nextOnlyToday));
              }}
              page={articlePage}
              pages={articlePages}
              total={articleTotal}
              onPageChange={(nextPage) => {
                setArticlePage(nextPage);
                void withErrorHandling(() => loadArticles(trashed, nextPage));
              }}
              onFiltersChange={(nextSearch, nextStatus) => {
                setArticleSearch(nextSearch);
                setArticleStatusFilter(nextStatus);
                setArticlePage(1);
                void withErrorHandling(() => loadArticles(trashed, 1, nextSearch, nextStatus, articleOnlyToday));
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
          {view === "comments" && !(loading && !comments.length) && (
            <CommentsView
              comments={comments}
              onStatus={changeCommentStatus}
              page={commentPage}
              pages={commentPages}
              onPageChange={(nextPage) => {
                setCommentPage(nextPage);
                void withErrorHandling(() => loadComments(nextPage));
              }}
              onFiltersChange={(nextSearch, nextStatus) => {
                setCommentSearch(nextSearch);
                setCommentStatus(nextStatus);
                setCommentPage(1);
                void withErrorHandling(() => loadComments(1, nextSearch, nextStatus));
              }}
            />
          )}
          {view === "ads" && !(loading && !ads.length) && (
            <AdsView
              ads={ads}
              onChanged={loadAds}
              page={adPage}
              pages={adPages}
              onPageChange={(nextPage) => {
                setAdPage(nextPage);
                void withErrorHandling(() => loadAds(nextPage));
              }}
            />
          )}
          {view === "users" && !(loading && !users.length) && (
            <UsersView
              users={users}
              page={userPage}
              pages={userPages}
              onPageChange={(nextPage) => {
                setUserPage(nextPage);
                void withErrorHandling(() => loadUsers(nextPage));
              }}
            />
          )}
          {view === "reports" && <ReportsView />}
          {view === "auditlog" && <AuditLogView />}
          {view === "aggregator" && <AggregatorView />}
          {view === "security" && <SecurityView onReauthenticate={() => { void handleLogout(); setSessionNotice("Xavfsizlik sozlamasi o'zgardi. Qaytadan kiring."); }} />}
        </div>
      </section>

      <AdminMobileNav
        view={view}
        theme={theme}
        onSelect={(nextView) => { void selectView(nextView); }}
        onToggleTheme={toggleTheme}
        onLogout={() => { void handleLogout(); }}
      />
    </main>
  );
}

const mobilePrimaryMenu: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Asosiy", icon: LayoutDashboard },
  { id: "articles", label: "Yangiliklar", icon: Newspaper },
  { id: "new", label: "Yangi", icon: FilePlus2 },
  { id: "comments", label: "Izohlar", icon: MessageCircle }
];

const mobilePrimaryIds = new Set<View>(["dashboard", "articles", "new", "comments"]);
const mobileMoreMenu = menu.filter((item) => !mobilePrimaryIds.has(item.id));

function AdminMobileNav({
  view,
  theme,
  onSelect,
  onToggleTheme,
  onLogout
}: {
  view: View;
  theme: string;
  onSelect: (view: View) => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreOpen]);

  const select = (nextView: View) => {
    setMoreOpen(false);
    onSelect(nextView);
  };

  const isActive = (id: View) => {
    if (id === "dashboard") return view === "dashboard" || view === "stats";
    if (id === "articles") return view === "articles" || view === "edit" || view === "preview";
    return view === id;
  };

  const moreActive = moreOpen || (!mobilePrimaryIds.has(view) && view !== "edit" && view !== "preview" && view !== "stats");

  return (
    <>
      {moreOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-slate-950/65 backdrop-blur-sm lg:hidden"
            onClick={() => setMoreOpen(false)}
            aria-label="Admin menyusini yopish"
          />
          <section
            id="admin-mobile-more"
            role="dialog"
            aria-modal="true"
            aria-label="Boshqa admin bo'limlari"
            className="fixed inset-x-3 z-[90] max-h-[68dvh] overflow-y-auto rounded-lg border border-cyan-300/20 bg-[#071827] p-3 text-white shadow-2xl shadow-black/50 lg:hidden"
            style={{ bottom: "calc(4.9rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <p className="text-sm font-black">Admin bo'limlari</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">Boshqaruv va xavfsizlik vositalari</p>
              </div>
              <IconButton
                icon={<X size={18} />}
                label="Menyuni yopish"
                variant="ghost"
                className="text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={() => setMoreOpen(false)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {mobileMoreMenu.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => select(id)}
                  className={`flex min-h-14 items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-black transition ${
                    isActive(id)
                      ? "border-brand bg-brand text-white"
                      : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-300/30 hover:bg-white/[0.08]"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="min-w-0 leading-4">{label}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] text-xs font-black text-slate-200 transition hover:bg-white/[0.08]"
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                {theme === "dark" ? "Kunduz" : "Tun"}
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-red-400/25 bg-red-500/10 text-xs font-black text-red-300 transition hover:bg-red-500/20"
              >
                <LogOut size={17} />
                Chiqish
              </button>
            </div>
          </section>
        </>
      )}

      <nav
        className="fixed inset-x-3 z-[100] grid h-16 grid-cols-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#071827]/95 px-1 text-slate-400 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden"
        style={{ bottom: "max(0.7rem, env(safe-area-inset-bottom))" }}
        aria-label="Admin mobil navigatsiyasi"
      >
        {mobilePrimaryMenu.map(({ id, label, icon: Icon }) => {
          const active = isActive(id);
          return (
            <button
              type="button"
              key={id}
              onClick={() => select(id)}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-md transition ${
                active ? "bg-brand/15 text-white" : "hover:bg-white/[0.05] hover:text-slate-200"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={id === "new" ? 22 : 20} className={active || id === "new" ? "text-blue-400" : ""} />
              <span className="max-w-full truncate px-1 text-[10px] font-black leading-none">{label}</span>
              {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-400" />}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-md transition ${
            moreActive ? "bg-brand/15 text-white" : "hover:bg-white/[0.05] hover:text-slate-200"
          }`}
          aria-expanded={moreOpen}
          aria-controls="admin-mobile-more"
        >
          <Menu size={20} className={moreActive ? "text-blue-400" : ""} />
          <span className="text-[10px] font-black leading-none">Boshqa</span>
          {moreActive && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-400" />}
        </button>
      </nav>
    </>
  );
}
