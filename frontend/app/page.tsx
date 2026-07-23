import { ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Header } from "../components/Header";
import { HomeNewsStream } from "../components/HomeNewsStream";
import { MediaView } from "../components/MediaView";
import { MobileCurrencyCard } from "../components/MobileCurrency";
import { NewsCard } from "../components/NewsCard";
import { getArticles, getPopularArticles, getTrendingArticles } from "../lib/api";
import { formatArticleDateTime, formatViews } from "../lib/format";
import { getRequestLang } from "../lib/server-lang";

const homeCopy = {
  uz: {
    categories: { all: "Barchasi", ozbekiston: "O'zbekiston", dunyo: "Dunyo", siyosat: "Siyosat", iqtisodiyot: "Iqtisodiyot", texnologiya: "Texnologiya", sport: "Sport", madaniyat: "Madaniyat" },
    noNews: "Yangiliklar hali qo'shilmagan",
    noNewsHelp: "Admin panel orqali yangi maqola qo'shing. Published qilingan xabarlar shu yerda avtomatik ko'rinadi.",
    admin: "Admin panelga o'tish",
    readMore: "Batafsil o'qish",
    todayTrend: "Bugungi trend",
    fourDayPopular: "4 kunlik ko'p o'qilganlar",
    all: "Barchasi",
    trend: "Trend bo'layotgan",
    noTrend: "Bugun trend xabarlar hali shakllanmadi.",
    allPopular: "Barcha mashhur yangiliklar",
    latest: "So'nggi yangiliklar",
    editorChoice: "Muharrir tanlovi",
    moreNews: "Ko'proq yangiliklar",
    filter: "Saralash",
    popular: "Eng ko'p o'qilganlar",
    noPopular: "Oxirgi 4 kunda ko'p o'qilganlar hali yo'q."
  },
  ru: {
    categories: { all: "Все", ozbekiston: "Узбекистан", dunyo: "Мир", siyosat: "Политика", iqtisodiyot: "Экономика", texnologiya: "Технологии", sport: "Спорт", madaniyat: "Культура" },
    noNews: "Новостей пока нет",
    noNewsHelp: "Опубликованные материалы автоматически появятся здесь.",
    admin: "Открыть админ-панель",
    readMore: "Читать далее",
    todayTrend: "Сегодня в тренде",
    fourDayPopular: "Популярное за 4 дня",
    all: "Все",
    trend: "В тренде",
    noTrend: "Сегодня трендовые новости еще не сформировались.",
    allPopular: "Все популярные новости",
    latest: "Последние новости",
    editorChoice: "Выбор редакции",
    moreNews: "Больше новостей",
    filter: "Фильтр",
    popular: "Самые читаемые",
    noPopular: "За последние 4 дня популярных новостей пока нет."
  },
  en: {
    categories: { all: "All", ozbekiston: "Uzbekistan", dunyo: "World", siyosat: "Politics", iqtisodiyot: "Business", texnologiya: "Technology", sport: "Sport", madaniyat: "Culture" },
    noNews: "No news has been published yet",
    noNewsHelp: "Published articles will appear here automatically.",
    admin: "Open admin panel",
    readMore: "Read more",
    todayTrend: "Trending today",
    fourDayPopular: "Popular over 4 days",
    all: "All",
    trend: "Trending",
    noTrend: "Today's trending stories have not formed yet.",
    allPopular: "All popular news",
    latest: "Latest news",
    editorChoice: "Editor's choice",
    moreNews: "More news",
    filter: "Filter",
    popular: "Most read",
    noPopular: "There are no popular stories from the last 4 days yet."
  }
} as const;

const categorySlugs = ["ozbekiston", "dunyo", "iqtisodiyot", "sport", "texnologiya", "madaniyat"] as const;

export default async function Home() {
  const lang = await getRequestLang();
  return <CachedHome lang={lang} />;
}

async function CachedHome({ lang }: { lang: "uz" | "ru" | "en" }) {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });

  const copy = homeCopy[lang];
  const categoryTabs = [
    [copy.categories.all, "/"],
    [copy.categories.ozbekiston, "/category/ozbekiston"],
    [copy.categories.dunyo, "/category/dunyo"],
    [copy.categories.siyosat, "/category/siyosat"],
    [copy.categories.iqtisodiyot, "/category/iqtisodiyot"],
    [copy.categories.texnologiya, "/category/texnologiya"],
    [copy.categories.sport, "/category/sport"],
    [copy.categories.madaniyat, "/category/madaniyat"]
  ];
  const categorySections = categorySlugs.map((slug) => ({ title: copy.categories[slug], slug }));
  const categoryName = (category?: { name: string; slug: string }) => category ? copy.categories[category.slug as keyof typeof copy.categories] ?? category.name : "";
  const [articles, trending, popular] = await Promise.all([getArticles("?limit=20", lang), getTrendingArticles(lang, 8), getPopularArticles(lang, 8, 4)]);

  // showOnHome is the master on/off switch -- everything below is drawn from this pool only.
  const eligible = articles.filter((item) => item.showOnHome !== false);

  // showInSlider curates the lead story; fall back to the newest eligible article so the
  // homepage still has a hero before any editor has flagged anything.
  const sliderPool = eligible.filter((item) => item.showInSlider);
  const hero = sliderPool[0] ?? eligible[0];
  const rest = eligible.filter((item) => item.id !== hero?.id);

  // isEditorChoice curates "Muharrir tanlovi"; same graceful fallback to the general pool.
  const editorPool = rest.filter((item) => item.isEditorChoice);
  const editorLead = editorPool[0] ?? rest[15] ?? rest[4];
  const editorList = editorPool.length > 1 ? editorPool.slice(1, 5) : rest.slice(16, 20);
  const editorIds = new Set([editorLead?.id, ...editorList.map((item) => item.id)].filter(Boolean));

  // showInLatest gates the general recency-based sections; exclude whatever the editor
  // section already used so the same article isn't repeated twice on the page.
  const generalPool = rest.filter((item) => item.showInLatest !== false && !editorIds.has(item.id));
  const side = generalPool.slice(0, 3);
  const latest = generalPool.slice(3, 15);

  const trendingItems = trending;
  const popularItems = popular;
  const sectionGroups = categorySections
    .map((section) => ({
      ...section,
      items: eligible.filter((item) => item.category?.slug === section.slug).slice(0, 4)
    }))
    .filter((section) => section.items.length >= 2);

  if (!hero) {
    return (
      <main>
        <Header />
        <section className="container-page py-16">
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center news-shadow">
            <h1 className="text-3xl font-black">{copy.noNews}</h1>
            <p className="mx-auto mt-3 max-w-xl text-slate-500">{copy.noNewsHelp}</p>
            <Link href="/admin" className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-brand px-5 font-black text-white">
              {copy.admin}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <Header />
      <section className="home-lead-grid container-page grid gap-4 py-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)] lg:gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.95fr)_minmax(300px,0.9fr)]">
        <Link href={`/articles/${hero.slug}`} className="home-hero relative block h-[360px] overflow-hidden rounded-lg bg-ink text-white news-shadow sm:h-[506px]">
          <MediaView
            src={hero.mainImage}
            alt={hero.title}
            className="absolute inset-0 h-full w-full object-cover"
            priority
            sizes="(max-width: 900px) calc(100vw - 20px), (max-width: 1279px) 62vw, 46vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-5 sm:p-7">
            <span className="absolute left-5 top-5 w-fit rounded-md bg-brand px-3 py-1.5 text-xs font-black uppercase shadow-lg sm:left-6 sm:top-7">{categoryName(hero.category)}</span>
            <p className="text-[14px] font-bold text-white/90 sm:text-[15px]">{formatArticleDateTime(hero.publishedAt, lang)} · {formatViews(hero.viewsCount, lang)}</p>
            <h1 className="mt-2 max-w-[610px] text-[25px] font-black leading-[1.14] sm:mt-3 sm:text-[34px] sm:leading-[1.2]">{hero.title}</h1>
            <p className="mt-2 max-w-[620px] line-clamp-3 text-[14px] leading-6 text-white/92 sm:mt-3 sm:text-[17px] sm:leading-7">{hero.shortDescription || hero.summary}</p>
            <span className="mt-5 flex h-[44px] w-fit items-center gap-4 rounded-md border border-white/45 px-5 text-[14px] font-black transition hover:bg-white hover:text-ink sm:mt-6 sm:h-[46px]">
              {copy.readMore} <ArrowRight size={18} />
            </span>
          </div>
        </Link>

        <div className="grid gap-3 lg:hidden">
          <section className="mobile-home-rail news-shadow rounded-lg border border-cyan-300/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[18px] font-black text-white">{copy.todayTrend}</h2>
              <TrendingUp className="text-brand" size={20} />
            </div>
            <div className="grid gap-2">
              {(trendingItems.length ? trendingItems : latest).slice(0, 3).map((item, index) => (
                <Link key={item.id} href={`/articles/${item.slug}`} className="grid grid-cols-[30px_1fr_64px] items-center gap-3 rounded-lg border border-cyan-300/15 bg-white/6 p-2.5 transition active:scale-[0.98]">
                  <span className="grid size-7 place-items-center rounded-full bg-brand text-[12px] font-black text-white">{index + 1}</span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[14px] font-black leading-snug text-white">{item.title}</span>
                    <span className="mt-1 block text-[12px] font-bold text-slate-300">{formatViews(item.viewsCount, lang)}</span>
                  </span>
                  <MediaView src={item.mainImage} className="h-14 w-16 rounded-md object-cover" sizes="64px" optimizedWidth={256} />
                </Link>
              ))}
            </div>
          </section>

          <MobileCurrencyCard />

          <section className="mobile-home-rail news-shadow rounded-lg border border-cyan-300/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[18px] font-black text-white">{copy.fourDayPopular}</h2>
              <Link href="/popular" className="text-[12px] font-black text-brand">{copy.all}</Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(popularItems.length ? popularItems : latest).slice(0, 4).map((item) => (
                <Link key={item.id} href={`/articles/${item.slug}`} className="overflow-hidden rounded-lg border border-cyan-300/15 bg-white/6 transition active:scale-[0.98]">
                  <MediaView src={item.mainImage} className="h-20 w-full object-cover" sizes="calc((100vw - 44px) / 2)" optimizedWidth={640} />
                  <div className="p-2">
                    <h3 className="line-clamp-2 text-[12.5px] font-black leading-snug text-white">{item.title}</h3>
                    <p className="mt-1 text-[11px] font-bold text-slate-300">{formatViews(item.viewsCount, lang)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="home-side-stack grid content-start gap-[18px]">
          {side.map((item) => (
            <Link
              key={item.id}
              href={`/articles/${item.slug}`}
              className={`home-side-card news-shadow grid gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand ${item.mainImage ? "grid-cols-[92px_1fr] sm:h-[157px] sm:grid-cols-[138px_1fr]" : "grid-cols-1"}`}
            >
              <MediaView src={item.mainImage} className="home-side-media h-24 w-[92px] rounded-md object-cover sm:h-[130px] sm:w-[138px]" sizes="138px" optimizedWidth={384} />
              <div className="min-w-0 py-1">
                <span className="text-[12px] font-black uppercase text-brand">{categoryName(item.category)}</span>
                <p className="mt-2 line-clamp-2 text-[15px] font-black leading-snug sm:mt-3 sm:text-[16px]">{item.title}</p>
                <p className="mt-2 text-[12px] font-bold text-slate-500 sm:mt-4 sm:text-[14px]">{formatArticleDateTime(item.publishedAt, lang)}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="home-trend-rail hidden flex-col gap-4 xl:sticky xl:top-24 xl:flex xl:self-start">
          <aside className="home-glass-panel home-trend-panel news-shadow rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[22px] font-black">{copy.trend}</h2>
              <TrendingUp className="text-brand" />
            </div>
            <div className="grid gap-3">
              {!trendingItems.length && <p className="home-empty-state rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">{copy.noTrend}</p>}
              {trendingItems.map((item, index) => (
                <Link
                  key={item.id}
                  href={`/articles/${item.slug}`}
                  className={`home-rank-card grid gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand ${item.mainImage ? "grid-cols-[30px_1fr] sm:grid-cols-[30px_1fr_80px]" : "grid-cols-[30px_1fr]"}`}
                >
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">{index + 1}</span>
                  <div>
                    <p className="text-[15px] font-black leading-snug">{item.title}</p>
                    <p className="mt-2 text-[13px] text-slate-500">{formatViews(item.viewsCount, lang)}</p>
                  </div>
                  <MediaView src={item.mainImage} className="hidden h-[78px] w-[80px] rounded-md object-cover sm:block" sizes="80px" optimizedWidth={256} />
                </Link>
              ))}
            </div>
            <Link href="/popular" className="home-outline-action mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-md border border-slate-200 bg-white text-[14px] font-black transition hover:border-brand hover:text-brand">
              {copy.allPopular} <ArrowRight size={17} />
            </Link>
          </aside>
        </div>

        <div className="home-latest-block lg:col-span-2">
          <div className="home-section-head mb-4 flex flex-wrap items-center gap-2">
            <h2 className="section-title mr-auto text-[27px] font-black">{copy.latest}</h2>
            {categoryTabs.map(([item, href], index) => (
              <Link key={item} href={href} className={`home-filter-chip flex h-9 items-center rounded-full border px-4 text-[13px] font-bold transition ${index === 0 ? "is-active border-brand bg-brand text-white shadow-lg shadow-blue-500/20" : "border-slate-200 bg-white text-ink hover:border-brand hover:text-brand"}`}>{item}</Link>
            ))}
          </div>
          <div className="home-news-grid grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {latest.map((item) => <NewsCard key={item.id} article={item} language={lang} />)}
          </div>
        </div>
      </section>

      <section className="home-content-grid container-page grid gap-4 pb-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_354px]">
        <div className="grid gap-4 lg:gap-6">
          {editorLead && (
            <section className="home-editor-section grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
              <Link href={`/articles/${editorLead.slug}`} className="home-editor-lead relative min-h-[360px] overflow-hidden rounded-lg bg-ink text-white news-shadow">
                <MediaView src={editorLead.mainImage} className="absolute inset-0 h-full w-full object-cover" sizes="(max-width: 1023px) calc(100vw - 20px), 55vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                <div className="relative flex min-h-[360px] flex-col justify-end p-7">
                  <span className="mb-4 w-fit rounded-md bg-brand px-3 py-1.5 text-xs font-black uppercase">{categoryName(editorLead.category)}</span>
                  <h2 className="max-w-2xl text-[30px] font-black leading-tight">{copy.editorChoice}: {editorLead.title}</h2>
                  <p className="mt-3 max-w-2xl text-[16px] leading-7 text-white/90">{editorLead.shortDescription || editorLead.summary}</p>
                  <span className="mt-5 flex h-11 w-fit items-center gap-3 rounded-md border border-white/45 px-5 text-sm font-black transition hover:bg-white hover:text-ink">
                    {copy.readMore} <ArrowRight size={17} />
                  </span>
                </div>
              </Link>
              <div className="grid gap-3">
                {editorList.map((item) => (
                  <Link key={item.id} href={`/articles/${item.slug}`} className="home-side-card home-editor-item news-shadow flex gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand">
                    <MediaView src={item.mainImage} className="home-side-media h-24 w-24 shrink-0 rounded-md object-cover sm:w-28" sizes="112px" optimizedWidth={384} />
                    <div className="min-w-0">
                      <span className="text-[12px] font-black uppercase text-brand">{categoryName(item.category)}</span>
                      <h3 className="mt-2 line-clamp-2 text-[16px] font-black leading-snug">{item.title}</h3>
                      <p className="mt-2 text-[13px] text-slate-500">{formatArticleDateTime(item.publishedAt, lang)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {sectionGroups.map((section) => (
              <section key={section.slug} className="home-category-panel home-glass-panel news-shadow rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-[22px] font-black">{section.title}</h2>
                  <Link href={`/category/${section.slug}`} className="flex items-center gap-2 text-sm font-black text-brand">
                    {copy.all} <ArrowRight size={16} />
                  </Link>
                </div>
                <div className="grid gap-3">
                  {section.items.map((item, index) => (
                    <Link
                      key={item.id}
                      href={`/articles/${item.slug}`}
                      className={`home-category-row grid gap-3 rounded-lg transition hover:bg-white/10 ${
                        item.mainImage ? (index === 0 ? "sm:grid-cols-[160px_1fr]" : "sm:grid-cols-[92px_1fr]") : "grid-cols-1"
                      }`}
                    >
                      <MediaView
                        src={item.mainImage}
                        className={`${index === 0 ? "h-32 sm:w-40" : "h-32 w-full sm:h-20 sm:w-[92px]"} rounded-md object-cover`}
                        sizes={index === 0 ? "160px" : "92px"}
                        optimizedWidth={384}
                      />
                      <div className="min-w-0 py-1">
                        <h3 className={`${index === 0 ? "text-[18px]" : "text-[15px]"} line-clamp-2 font-black leading-snug`}>{item.title}</h3>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.shortDescription || item.summary}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <HomeNewsStream language={lang} title={copy.moreNews} filterLabel={copy.filter} />
        </div>

        <aside className="home-popular-rail hidden content-start gap-4 lg:sticky lg:top-24 lg:grid lg:self-start">
          <section className="home-popular-panel home-glass-panel news-shadow rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[22px] font-black">{copy.popular}</h2>
              <TrendingUp className="text-brand" />
            </div>
            <div className="grid gap-4">
              {!popularItems.length && <p className="home-empty-state rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">{copy.noPopular}</p>}
              {popularItems.map((item, index) => (
                <Link key={item.id} href={`/articles/${item.slug}`} className="home-rank-card grid grid-cols-[32px_1fr] gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand">
                  <span className="mt-1 grid size-8 place-items-center rounded-full bg-brand text-sm font-black text-white">{index + 1}</span>
                  <span>
                    <span className="line-clamp-2 text-[15px] font-black leading-snug">{item.title}</span>
                    <span className="mt-1 block text-[13px] text-slate-500">{formatViews(item.viewsCount, lang)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </section>

    </main>
  );
}
