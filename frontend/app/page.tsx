import { ArrowRight, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Header } from "../components/Header";
import { MediaView } from "../components/MediaView";
import { NewsCard } from "../components/NewsCard";
import { SubscribeBox } from "../components/SubscribeBox";
import { getArticles, getTrendingArticles } from "../lib/api";
import { formatArticleDateTime, formatViews } from "../lib/format";
import { getRequestLang } from "../lib/server-lang";
import { SITE_LOGO, SITE_NAME } from "../lib/site";

export default async function Home() {
  const lang = await getRequestLang();
  const [articles, trending] = await Promise.all([getArticles("?limit=12", lang), getTrendingArticles(lang, 5)]);
  const [hero, ...rest] = articles;
  const side = rest.slice(0, 3);
  const latest = rest.slice(0, 6);
  // Last 24h view velocity (not just lifetime views), falls back to the fetched list if there's
  // not enough recent view data yet (e.g. right after launch).
  const trendingItems = trending.length ? trending : [articles[4], articles[8], articles[9], articles[3], articles[7]].filter(Boolean);

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
      <section className="container-page grid gap-6 py-4 lg:grid-cols-[minmax(0,672px)_380px_354px]">
        <Link href={`/articles/${hero.slug}`} className="relative block h-[506px] overflow-hidden rounded-lg bg-ink text-white news-shadow">
          <MediaView src={hero.mainImage} className="absolute inset-0 h-full w-full object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-7">
            <span className="absolute left-6 top-7 w-fit rounded-md bg-brand px-3 py-1.5 text-xs font-black uppercase shadow-lg">{hero.category?.name}</span>
            <p className="text-[15px] font-medium">{formatArticleDateTime(hero.publishedAt)}</p>
            <h1 className="mt-3 max-w-[610px] text-[34px] font-black leading-[1.2]">{hero.title}</h1>
            <p className="mt-3 max-w-[620px] text-[17px] leading-7 text-white">{hero.summary}</p>
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
              className={`news-shadow grid h-[157px] gap-4 rounded-lg border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand ${item.mainImage ? "grid-cols-[138px_1fr]" : "grid-cols-1"}`}
            >
              <MediaView src={item.mainImage} className="h-[130px] w-[138px] rounded-md object-cover" />
              <div className="min-w-0 py-1">
                <span className="text-[12px] font-black uppercase text-brand">{item.category?.name}</span>
                <h3 className="mt-3 text-[16px] font-black leading-snug">{item.title}</h3>
                <p className="mt-4 text-[14px] text-slate-500">{formatArticleDateTime(item.publishedAt)}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="row-span-2 flex flex-col gap-4">
          <aside className="news-shadow rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[22px] font-black">Trend bo'layotgan</h2>
              <TrendingUp className="text-brand" />
            </div>
            <div className="space-y-[22px]">
              {trendingItems.map((item, index) => (
                <Link
                  key={item.id}
                  href={`/articles/${item.slug}`}
                  className={`grid gap-3 rounded-md transition hover:bg-white/10 ${item.mainImage ? "grid-cols-[30px_1fr_80px]" : "grid-cols-[30px_1fr]"}`}
                >
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">{index + 1}</span>
                  <div>
                    <p className="text-[15px] font-black leading-snug">{item.title}</p>
                    <p className="mt-2 text-[13px] text-slate-500">{formatViews(item.viewsCount)}</p>
                  </div>
                  <MediaView src={item.mainImage} className="h-[78px] w-[80px] rounded-md object-cover" />
                </Link>
              ))}
            </div>
            <Link href="/popular" className="mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-md border border-slate-200 bg-white text-[14px] font-black transition hover:border-brand hover:text-brand">
              Barcha mashhur yangiliklar <ArrowRight size={17} />
            </Link>
          </aside>

          <SubscribeBox />
        </div>

        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="section-title mr-auto text-[27px] font-black">So'nggi yangiliklar</h2>
            {[
              ["Barchasi", "/"],
              ["O'zbekiston", "/category/ozbekiston"],
              ["Dunyo", "/category/dunyo"],
              ["Siyosat", "/category/siyosat"],
              ["Iqtisodiyot", "/category/iqtisodiyot"],
              ["Texnologiya", "/category/texnologiya"],
              ["Sport", "/category/sport"],
              ["Madaniyat", "/category/madaniyat"]
            ].map(([item, href], index) => (
              <Link key={item} href={href} className={`flex h-9 items-center rounded-full border px-4 text-[13px] font-bold transition ${index === 0 ? "border-brand bg-brand text-white shadow-lg shadow-blue-500/20" : "border-slate-200 bg-white text-ink hover:border-brand hover:text-brand"}`}>{item}</Link>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {latest.slice(1, 5).map((item) => <NewsCard key={item.id} article={item} />)}
          </div>
        </div>
      </section>

      <footer className="bg-ink py-12 text-white">
        <div className="container-page grid gap-8 md:grid-cols-4">
          <div>
            <Image src={SITE_LOGO} alt={SITE_NAME} width={150} height={150} className="h-24 w-24 rounded-md object-cover" />
            <p className="mt-4 text-slate-300">Dunyodagi eng muhim voqealarni tez, ishonchli va xolis ravishda yetkazib beramiz.</p>
          </div>
          <div><h3 className="font-black">Bo'limlar</h3><div className="mt-4 grid gap-2 text-slate-300"><Link className="hover:text-white" href="/category/dunyo">Dunyo</Link><Link className="hover:text-white" href="/category/ozbekiston">O'zbekiston</Link><Link className="hover:text-white" href="/category/siyosat">Siyosat</Link><Link className="hover:text-white" href="/category/texnologiya">Texnologiya</Link></div></div>
          <div><h3 className="font-black">Foydali havolalar</h3><div className="mt-4 grid gap-2 text-slate-300"><Link className="hover:text-white" href="/about">Biz haqimizda</Link><Link className="hover:text-white" href="/contact">Aloqa</Link><Link className="hover:text-white" href="/ads">Reklama</Link><Link className="hover:text-white" href="/search">Qidiruv</Link></div></div>
          <div><h3 className="font-black">Bog'lanish</h3><p className="mt-4 text-slate-300">info@jahonxabarlari.uz<br />Toshkent, O'zbekiston</p></div>
        </div>
      </footer>
    </main>
  );
}
