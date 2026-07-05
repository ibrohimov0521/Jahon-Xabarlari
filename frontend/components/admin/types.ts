export type ArticleStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED";
export const ARTICLE_STATUSES: ArticleStatus[] = ["DRAFT", "REVIEW", "PUBLISHED", "SCHEDULED", "ARCHIVED"];

export type Category = { id: string; name: string; slug: string };

export type TranslationStatus = "PENDING" | "READY" | "FAILED";
export type ArticleTranslationSummary = { lang: string; status: TranslationStatus };

export type ArticleFlags = {
  isFeatured: boolean;
  isBreaking: boolean;
  isEditorChoice: boolean;
  showOnHome: boolean;
  showInSlider: boolean;
  showInSidebar: boolean;
  showInLatest: boolean;
  showInPopular: boolean;
};

export type Article = ArticleFlags & {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  mainImage?: string | null;
  gallery?: string[];
  status: ArticleStatus;
  scheduledAt?: string | null;
  viewsCount: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  categoryId?: string;
  extraCategoryIds?: string[];
  sourceName?: string | null;
  sourceUrl?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: { name: string; slug: string };
  author?: { name: string };
  translations?: ArticleTranslationSummary[];
};

export type Stats = {
  totalArticles: number;
  todayArticles: number;
  draftArticles: number;
  reviewArticles: number;
  users: number;
  subscribers: number;
  totalViews: number;
  popular: Pick<Article, "id" | "title" | "viewsCount">[];
};

export type CommentStatus = "PENDING" | "APPROVED" | "DELETED";
export const COMMENT_STATUSES: CommentStatus[] = ["PENDING", "APPROVED", "DELETED"];
export type CommentItem = {
  id: string;
  name: string;
  body: string;
  status: CommentStatus;
  createdAt: string;
  article?: { title: string; slug: string };
};

export type AdStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED";
export const AD_STATUSES: AdStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "EXPIRED"];
export type AdItem = {
  id: string;
  title: string;
  placement: string;
  imageUrl?: string | null;
  targetUrl?: string | null;
  status: AdStatus;
  updatedAt: string;
};

export type AuditLogItem = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: unknown;
  ip?: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
};

export type UserItem = {
  id: string;
  name: string;
  email: string;
  telegramId?: string | null;
  createdAt: string;
  updatedAt: string;
  role: { name: string };
};

export type ArticleFormState = {
  title: string;
  summary: string;
  content: string;
  mainImage: string;
  gallery: string[];
  categoryId: string;
  extraCategoryIds: string[];
  status: ArticleStatus;
  seoTitle: string;
  seoDescription: string;
} & ArticleFlags;

export const emptyArticleForm: ArticleFormState = {
  title: "",
  summary: "",
  content: "",
  mainImage: "",
  gallery: [],
  categoryId: "",
  extraCategoryIds: [],
  status: "DRAFT",
  seoTitle: "",
  seoDescription: "",
  isBreaking: false,
  isFeatured: false,
  isEditorChoice: false,
  showOnHome: true,
  showInSlider: false,
  showInSidebar: false,
  showInLatest: true,
  showInPopular: false
};

export const FLAG_LABELS: [keyof ArticleFlags, string][] = [
  ["isBreaking", "Breaking news"],
  ["isFeatured", "Featured"],
  ["isEditorChoice", "Editor choice"],
  ["showOnHome", "Bosh sahifada"],
  ["showInSlider", "Sliderda"],
  ["showInSidebar", "Sidebar"],
  ["showInLatest", "So'nggi yangiliklar"],
  ["showInPopular", "Popular"]
];
