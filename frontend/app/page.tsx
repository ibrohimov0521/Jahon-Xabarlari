import { ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Header } from "../components/Header";
import { MediaView } from "../components/MediaView";
import { NewsCard } from "../components/NewsCard";
import { getArticles, getPopularArticles, getTrendingArticles } from "../lib/api";
import { formatArticleDateTime, formatViews } from "../lib/format";
import { getRequestLang } from "../lib/server-lang";

const categoryTabs = [
  ["Barchasi", "/"],
  ["O'zbekiston", "/category/ozbekiston"],
  ["Dunyo", "/category/dunyo"],
  ["Siyosat", "/category/siyosat"],
  ["Iqtisodiyot", "/category/iqtisodiyot"],
  ["Texnologiya", "/category/texnologiya"],
  ["Sport", "/category/sport"],
  ["Madaniyat", "/category/madaniyat"]
];

const categorySections = [
  { title: "O'zbekiston", slug: "ozbekiston" },
  { title: "Dunyo", slug: "dunyo" },
  { title: "Iqtisodiyot", slug: "iqtisodiyot" },
  { title: "Sport", slug: "sport" },
  { title: "Texnologiya", slug: "texnologiya" },
  { title: "Madaniyat", slug: "madaniyat" }
];

export default async function Home() {
  const lang = await getRequestLang();
  const [articles, trending, popular] = await Promise.all([getArticles("?limit=36", lang), getTrendingArticles(lang, 8), getPopularArticles(lang, 8, 4)]);

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
  const extraStream = generalPool.slice(15, 27);

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
            <h1 className="text-3xl font-black">Yangiliklar hali qo'shilmagan</h1>
            <p className="mx-auto mt-3 max-w-xl text-slate-500">
              Admin panel orqali yangi maqola qo'shing. Published qilingan xabarlar shu yerda avtomatik ko'rinadi.
            </p>
            <Link href="/admin" className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-brand px-5 font-black text-white">
              Admin panelga o'tish
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <Header />
      <section className="container-page grid gap-4 py-4 lg:gap-6 lg:grid-cols-[minmax(0,672px)_380px_354px]">
        <Link href={`/articles/${hero.slug}`} className="relative block h-[420px] overflow-hidden rounded-lg bg-ink text-white news-shadow sm:h-[506px]">
          <MediaView src={hero.mainImage} className="absolute inset-0 h-full w-full object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-5 sm:p-7">
            <span className="absolute left-5 top-5 w-fit rounded-md bg-brand px-3 py-1.5 text-xs font-black uppercase shadow-lg sm:left-6 sm:top-7">{hero.category?.name}</span>
            <p className="text-[15px] font-medium">{formatArticleDateTime(hero.publishedAt)}</p>
            <h1 className="mt-3 max-w-[610px] text-[27px] font-black leading-[1.18] sm:text-[34px] sm:leading-[1.2]">{hero.title}</h1>
            <p className="mt-3 max-w-[620px] text-[15px] leading-6 text-white sm:text-[17px] sm:leading-7">{hero.shortDescription || hero.summary}</p>
            <span className="mt-6 flex h-[46px] w-fit items-center gap-4 rounded-md border border-white/45 px-5 text-[14px] font-black transition hover:bg-white hover:text-ink">
              Batafsil o'qish <ArrowRight size={18} />
            </span>
          </div>
        </Link>
        <div className="grid content-start gap-[18px]">
          {side.map((item, index) => (
            <Link
              key={item.id}
              href={`/articles/${item.slug}`}
              className={`news-shadow grid gap-4 rounded-lg border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand sm:h-[157px] ${item.mainImage ? "sm:grid-cols-[138px_1fr]" : "grid-cols-1"}`}
            >
              <MediaView src={item.mainImage} className="h-44 w-full rounded-md object-cover sm:h-[130px] sm:w-[138px]" />
              <div className="min-w-0 py-1">
                <span className="text-[12px] font-black uppercase text-brand">{item.category?.name}</span>
                <h3 className="mt-3 text-[16px] font-black leading-snug">{item.title}</h3>
                <p className="mt-4 text-[14px] text-slate-500">{formatArticleDateTime(item.publishedAt)}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="row-span-2 hidden flex-col gap-4 lg:sticky lg:top-24 lg:flex lg:self-start">
          <aside className="news-shadow rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[22px] font-black">Trend bo'layotgan</h2>
              <TrendingUp className="text-brand" />
            </div>
            <div className="grid gap-3">
              {!trendingItems.length && <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">Bugun trend xabarlar hali shakllanmadi.</p>}
              {trendingItems.map((item, index) => (
                <Link
                  key={item.id}
                  href={`/articles/${item.slug}`}
                  className={`grid gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand ${item.mainImage ? "grid-cols-[30px_1fr] sm:grid-cols-[30px_1fr_80px]" : "grid-cols-[30px_1fr]"}`}
                >
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">{index + 1}</span>
                  <div>
                    <p className="text-[15px] font-black leading-snug">{item.title}</p>
                    <p className="mt-2 text-[13px] text-slate-500">{formatViews(item.viewsCount)}</p>
                  </div>
                  <MediaView src={item.mainImage} className="hidden h-[78px] w-[80px] rounded-md object-cover sm:block" />
                </Link>
              ))}
            </div>
            <Link href="/popular" className="mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-md border border-slate-200 bg-white text-[14px] font-black transition hover:border-brand hover:text-brand">
              Barcha mashhur yangiliklar <ArrowRight size={17} />
            </Link>
          </aside>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="section-title mr-auto text-[27px] font-black">So'nggi yangiliklar</h2>
            {categoryTabs.map(([item, href], index) => (
              <Link key={item} href={href} className={`flex h-9 items-center rounded-full border px-4 text-[13px] font-bold transition ${index === 0 ? "border-brand bg-brand text-white shadow-lg shadow-blue-500/20" : "border-slate-200 bg-white text-ink hover:border-brand hover:text-brand"}`}>{item}</Link>
            ))}
          </div>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {latest.map((item) => <NewsCard key={item.id} article={item} />)}
          </div>
        </div>
      </section>

      <section className="container-page grid gap-4 pb-8 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_354px]">
        <div className="grid gap-4 lg:gap-6">
          {editorLead && (
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
              <Link href={`/articles/${editorLead.slug}`} className="relative min-h-[360px] overflow-hidden rounded-lg bg-ink text-white news-shadow">
                <MediaView src={editorLead.mainImage} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                <div className="relative flex min-h-[360px] flex-col justify-end p-7">
                  <span className="mb-4 w-fit rounded-md bg-brand px-3 py-1.5 text-xs font-black uppercase">{editorLead.category?.name}</span>
                  <h2 className="max-w-2xl text-[30px] font-black leading-tight">Muharrir tanlovi: {editorLead.title}</h2>
                  <p className="mt-3 max-w-2xl text-[16px] leading-7 text-white/90">{editorLead.shortDescription || editorLead.summary}</p>
                  <span className="mt-5 flex h-11 w-fit items-center gap-3 rounded-md border border-white/45 px-5 text-sm font-black transition hover:bg-white hover:text-ink">
                    Batafsil o'qish <ArrowRight size={17} />
                  </span>
                </div>
              </Link>
              <div className="grid gap-3">
                {editorList.map((item) => (
                  <Link key={item.id} href={`/articles/${item.slug}`} className="news-shadow flex gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand">
                    <MediaView src={item.mainImage} className="h-24 w-24 shrink-0 rounded-md object-cover sm:w-28" />
                    <div className="min-w-0">
                      <span className="text-[12px] font-black uppercase text-brand">{item.category?.name}</span>
                      <h3 className="mt-2 line-clamp-2 text-[16px] font-black leading-snug">{item.title}</h3>
                      <p className="mt-2 text-[13px] text-slate-500">{formatArticleDateTime(item.publishedAt)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {sectionGroups.map((section) => (
              <section key={section.slug} className="news-shadow rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-[22px] font-black">{section.title}</h2>
                  <Link href={`/category/${section.slug}`} className="flex items-center gap-2 text-sm font-black text-brand">
                    Barchasi <ArrowRight size={16} />
                  </Link>
                </div>
                <div className="grid gap-3">
                  {section.items.map((item, index) => (
                    <Link
                      key={item.id}
                      href={`/articles/${item.slug}`}
                      className={`grid gap-3 rounded-lg transition hover:bg-white/10 ${
                        item.mainImage ? (index === 0 ? "sm:grid-cols-[160px_1fr]" : "sm:grid-cols-[92px_1fr]") : "grid-cols-1"
                      }`}
                    >
                      <MediaView src={item.mainImage} className={`${index === 0 ? "h-32 sm:w-40" : "h-32 w-full sm:h-20 sm:w-[92px]"} rounded-md object-cover`} />
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

          {!!extraStream.length && (
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="section-title text-[27px] font-black">Ko'proq yangiliklar</h2>
                <Link href="/search" className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-ink transition hover:border-brand hover:text-brand">
                  Saralash <ArrowRight size={16} />
                </Link>
              </div>
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {extraStream.map((item) => <NewsCard key={item.id} article={item} />)}
              </div>
            </section>
          )}
        </div>

        <aside className="hidden content-start gap-4 lg:sticky lg:top-24 lg:grid lg:self-start">
          <section className="news-shadow rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[22px] font-black">Eng ko'p o'qilganlar</h2>
              <TrendingUp className="text-brand" />
            </div>
            <div className="grid gap-4">
              {!popularItems.length && <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">Oxirgi 4 kunda ko'p o'qilganlar hali yo'q.</p>}
              {popularItems.map((item, index) => (
                <Link key={item.id} href={`/articles/${item.slug}`} className="grid grid-cols-[32px_1fr] gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand">
                  <span className="mt-1 grid size-8 place-items-center rounded-full bg-brand text-sm font-black text-white">{index + 1}</span>
                  <span>
                    <span className="line-clamp-2 text-[15px] font-black leading-snug">{item.title}</span>
                    <span className="mt-1 block text-[13px] text-slate-500">{formatViews(item.viewsCount)}</span>
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
