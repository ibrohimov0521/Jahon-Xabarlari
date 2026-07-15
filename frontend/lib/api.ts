export type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  shortDescription?: string | null;
  content: string;
  mainImage?: string;
  gallery?: string[];
  viewsCount: number;
  publishedAt?: string;
  updatedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  author?: { name: string } | null;
  tags?: { tag: { id?: string; name: string; slug: string } }[];
  category?: { name: string; slug: string };
  isFeatured?: boolean;
  isBreaking?: boolean;
  isEditorChoice?: boolean;
  showOnHome?: boolean;
  showInSlider?: boolean;
  showInSidebar?: boolean;
  showInLatest?: boolean;
  showInPopular?: boolean;
};

import { API_URL } from "./config";
import { timeoutSignal } from "./http";

// "uz" is the native/default content language already stored on the article, so there's
// no need to ask the backend for a translation in that case.
function withLang(url: string, lang?: string) {
  if (!lang || lang === "uz") return url;
  return `${url}${url.includes("?") ? "&" : "?"}lang=${encodeURIComponent(lang)}`;
}

export async function getArticles(params = "", lang?: string) {
  try {
    const res = await fetch(withLang(`${API_URL}/articles${params}`, lang), { next: { revalidate: 60 }, signal: timeoutSignal() });
    if (!res.ok) throw new Error("API error");
    return (await res.json()).items as Article[];
  } catch {
    return process.env.NODE_ENV === "development" && !params.includes("category=") ? demoArticles : [];
  }
}

// Unlike the list endpoints below, a single article that's missing or errored must not be
// papered over with unrelated demo content -- the caller renders a real 404 for null.
export async function getArticle(slug: string, lang?: string): Promise<Article | null> {
  try {
    const res = await fetch(withLang(`${API_URL}/articles/${slug}`, lang), { next: { revalidate: 60 }, signal: timeoutSignal() });
    if (!res.ok) return null;
    return (await res.json()) as Article;
  } catch {
    return null;
  }
}

export async function getArticleContext(slug: string, lang?: string): Promise<{ related: Article[]; next: Article | null }> {
  try {
    const res = await fetch(withLang(`${API_URL}/articles/${slug}/context`, lang), { next: { revalidate: 120 }, signal: timeoutSignal() });
    if (!res.ok) return { related: [], next: null };
    return (await res.json()) as { related: Article[]; next: Article | null };
  } catch {
    return { related: [], next: null };
  }
}

export async function getTrendingArticles(lang?: string, limit = 5) {
  try {
    const res = await fetch(withLang(`${API_URL}/articles/trending?limit=${limit}`, lang), { next: { revalidate: 120 }, signal: timeoutSignal() });
    if (!res.ok) throw new Error("API error");
    return (await res.json()).items as Article[];
  } catch {
    return [];
  }
}

export async function getPopularArticles(lang?: string, limit = 8, days = 4) {
  try {
    const res = await fetch(withLang(`${API_URL}/articles/popular?limit=${limit}&days=${days}`, lang), { next: { revalidate: 120 }, signal: timeoutSignal() });
    if (!res.ok) throw new Error("API error");
    return (await res.json()).items as Article[];
  } catch {
    return [];
  }
}

export type Comment = { id: string; name: string; body: string; createdAt: string };

export async function getComments(articleId: string): Promise<Comment[]> {
  try {
    const res = await fetch(`${API_URL}/articles/${articleId}/comments`, { cache: "no-store", signal: timeoutSignal() });
    if (!res.ok) return [];
    return (await res.json()).items as Comment[];
  } catch {
    return [];
  }
}

export async function submitComment(articleId: string, name: string, body: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${API_URL}/articles/${articleId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, body }),
      signal: timeoutSignal()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data.message ?? "Izohni yuborib bo'lmadi" };
    return { ok: true, message: data.message ?? "Izohingiz yuborildi" };
  } catch {
    return { ok: false, message: "Izohni yuborib bo'lmadi" };
  }
}

export async function submitArticleReport(
  articleId: string,
  payload: { reason: "FACT_ERROR" | "TYPO" | "COPYRIGHT" | "INAPPROPRIATE" | "OTHER"; details: string; email?: string }
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${API_URL}/articles/${articleId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: timeoutSignal()
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data.message ?? (res.ok ? "Xabaringiz yuborildi" : "Xabar yuborilmadi") };
  } catch {
    return { ok: false, message: "Xabar yuborilmadi" };
  }
}

export async function searchArticles(q: string, lang?: string, params = "") {
  try {
    const res = await fetch(withLang(`${API_URL}/search?q=${encodeURIComponent(q)}${params}`, lang), { next: { revalidate: 30 }, signal: timeoutSignal() });
    if (!res.ok) throw new Error("API error");
    return (await res.json()).items as Article[];
  } catch {
    if (process.env.NODE_ENV !== "development") return [];
    const needle = q.toLowerCase();
    return demoArticles.filter((item) => `${item.title} ${item.summary} ${item.category?.name}`.toLowerCase().includes(needle));
  }
}

export async function recordArticleView(articleId: string): Promise<number | null> {
  try {
    const res = await fetch(`${API_URL}/articles/${articleId}/view`, { method: "POST", keepalive: true, signal: timeoutSignal(8_000) });
    if (!res.ok) return null;
    return ((await res.json()) as { viewsCount: number }).viewsCount;
  } catch {
    return null;
  }
}

export const demoArticles: Article[] = [
  {
    id: "1",
    title: "Yer sayyorasining kelajagi: olimlar muhim ogohlantirish berdi",
    slug: "yer-sayyorasining-kelajagi",
    summary: "Iqlim o'zgarishi, texnologik taraqqiyot va inson omili sayyoramiz kelajagiga ta'sir ko'rsatmoqda.",
    content: "Jahon Xabarlari tahririyati dunyodagi eng muhim voqealarni tezkor va xolis yoritadi.",
    mainImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=90",
    viewsCount: 12500,
    category: { name: "Dunyo", slug: "dunyo" }
  },
  {
    id: "2",
    title: "BMT: Dunyo tinchligi uchun yangi tashabbus",
    slug: "bmt-dunyo-tinchligi",
    summary: "Diplomatlar mintaqaviy xavfsizlik bo'yicha yangi muzokaralarni boshladi.",
    content: "Tashabbus xalqaro hamkorlikni kuchaytirishga qaratilgan.",
    mainImage: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=800&q=85",
    viewsCount: 8700,
    category: { name: "Siyosat", slug: "siyosat" }
  },
  {
    id: "3",
    title: "O'zbekiston iqtisodiyoti barqaror o'sishda davom etmoqda",
    slug: "ozbekiston-iqtisodiyoti-barqaror",
    summary: "Iqtisodiy faollik va investitsiyalar bo'yicha yangi ko'rsatkichlar e'lon qilindi.",
    content: "Mutaxassislar iqtisodiy o'sish omillarini tahlil qilmoqda.",
    mainImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=85",
    viewsCount: 9870,
    category: { name: "Iqtisodiyot", slug: "iqtisodiyot" }
  },
  {
    id: "4",
    title: "Sun'iy intellekt hayotimizni qanday o'zgartirmoqda?",
    slug: "suniy-intellekt-hayotimizni",
    summary: "Yangi AI xizmatlari ta'lim, biznes va media sohalarida tez joriy etilmoqda.",
    content: "Mutaxassislar AI imkoniyatlari bilan birga mas'uliyatli yondashuv zarurligini aytmoqda.",
    mainImage: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=85",
    viewsCount: 7530,
    category: { name: "Texnologiya", slug: "texnologiya" }
  },
  {
    id: "5",
    title: "Toshkentda yangi bog' ochildi",
    slug: "toshkentda-yangi-bog-ochildi",
    summary: "Poytaxt aholisi uchun zamonaviy dam olish hududi foydalanishga topshirildi.",
    content: "Yangi bog'da sayr yo'laklari, yashil hududlar va oilaviy maydonchalar mavjud.",
    mainImage: "https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?auto=format&fit=crop&w=800&q=80",
    viewsCount: 12400,
    category: { name: "O'zbekiston", slug: "ozbekiston" }
  },
  {
    id: "6",
    title: "Yevropa Ittifoqi yangi sanksiyalar paketini tasdiqladi",
    slug: "yevropa-ittifoqi-yangi-sanksiyalar",
    summary: "Diplomatlar yangi paket bo'yicha kelishuvga erishdi.",
    content: "Qaror xalqaro siyosiy jarayonlar fonida qabul qilindi.",
    mainImage: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=800&q=80",
    viewsCount: 9800,
    category: { name: "Dunyo", slug: "dunyo" }
  },
  {
    id: "7",
    title: "O'zbekiston fond bozori o'sishda davom etmoqda",
    slug: "fond-bozori-osishda",
    summary: "Savdo hajmi oshib, investorlar faolligi kuchaydi.",
    content: "Bozor ishtirokchilari ijobiy dinamikani qayd etmoqda.",
    mainImage: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=800&q=80",
    viewsCount: 7200,
    category: { name: "Iqtisodiyot", slug: "iqtisodiyot" }
  },
  {
    id: "8",
    title: "Real Madrid navbatdagi g'alabasiga erishdi",
    slug: "real-madrid-navbatdagi-galaba",
    summary: "Klub navbatdagi turda ishonchli o'yin namoyish etdi.",
    content: "Murabbiy jamoa intizomi va hujumdagi aniqlikni alohida ta'kidladi.",
    mainImage: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80",
    viewsCount: 6100,
    category: { name: "Sport", slug: "sport" }
  },
  {
    id: "9",
    title: "Oltin narxi tarixiy maksimumni yangiladi",
    slug: "oltin-narxi-maksimum",
    summary: "Xalqaro bozorlarda qimmatbaho metallga talab oshmoqda.",
    content: "Ekspertlar global noaniqliklar narxlarga ta'sir qilayotganini bildirdi.",
    mainImage: "https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=800&q=80",
    viewsCount: 98700,
    category: { name: "Iqtisodiyot", slug: "iqtisodiyot" }
  },
  {
    id: "10",
    title: "Chelsea yana champion! London klubi g'alaba qozondi",
    slug: "chelsea-yana-champion",
    summary: "London klubi hal qiluvchi bahsda ustunlik qildi.",
    content: "Muxlislar g'alabani katta bayram bilan kutib oldi.",
    mainImage: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=800&q=80",
    viewsCount: 75300,
    category: { name: "Sport", slug: "sport" }
  }
];
