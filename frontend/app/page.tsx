import { ArrowRight, Send, TrendingUp } from "lucide-react";
import { Header } from "../components/Header";
import { NewsCard } from "../components/NewsCard";
import { getArticles } from "../lib/api";

export default async function Home() {
  const articles = await getArticles("?limit=12");
  const [hero, ...rest] = articles;
  const side = rest.slice(0, 3);
  const latest = rest.slice(0, 6);
  const popularImages = [articles[4], articles[8], articles[9], articles[3], articles[7]].filter(Boolean);

  return (
    <main>
      <Header />
      <section className="container-page grid gap-6 py-4 lg:grid-cols-[minmax(0,672px)_380px_354px]">
        <article className="relative h-[506px] overflow-hidden rounded-lg bg-ink text-white news-shadow">
          <img src={hero.mainImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-7">
            <span className="absolute left-6 top-7 w-fit rounded-md bg-brand px-3 py-1.5 text-xs font-black uppercase shadow-lg">{hero.category?.name}</span>
            <p className="text-[15px] font-medium">12 May, 2025&nbsp;&nbsp; • &nbsp;&nbsp;10:30</p>
            <h1 className="mt-3 max-w-[610px] text-[34px] font-black leading-[1.2]">{hero.title}</h1>
            <p className="mt-3 max-w-[620px] text-[17px] leading-7 text-white">{hero.summary}</p>
            <button className="mt-6 flex h-[46px] w-fit items-center gap-4 rounded-md border border-white/45 px-5 text-[14px] font-black transition hover:bg-white hover:text-ink">Batafsil o'qish <ArrowRight size={18} /></button>
          </div>
        </article>
        <div className="grid content-start gap-[18px]">
          {side.map((item, index) => (
            <article key={item.id} className="news-shadow grid h-[157px] grid-cols-[138px_1fr] gap-4 rounded-lg border border-slate-200 bg-white p-3">
              <img src={item.mainImage} alt="" className="h-[130px] w-[138px] rounded-md object-cover" />
              <div className="min-w-0 py-1">
                <span className="text-[12px] font-black uppercase text-brand">{item.category?.name}</span>
                <h3 className="mt-3 text-[16px] font-black leading-snug">{item.title}</h3>
                <p className="mt-4 text-[14px] text-slate-500">12 May, 2025&nbsp;&nbsp; • &nbsp;&nbsp;{index === 0 ? "09:15" : index === 1 ? "08:45" : "07:30"}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="row-span-2 flex flex-col gap-4">
          <aside className="news-shadow rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[22px] font-black">Eng ko'p o'qilgan</h2>
              <TrendingUp className="text-brand" />
            </div>
            <div className="space-y-[22px]">
              {popularImages.map((item, index) => (
                <div key={item.id} className="grid grid-cols-[30px_1fr_80px] gap-3">
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">{index + 1}</span>
                  <div>
                    <p className="text-[15px] font-black leading-snug">{item.title}</p>
                    <p className="mt-2 text-[13px] text-slate-500">{["120,5", "98,7", "75,3", "64,1", "58,2"][index]} ming o'qish</p>
                  </div>
                  <img src={item.mainImage} alt="" className="h-[78px] w-[80px] rounded-md object-cover" />
                </div>
              ))}
            </div>
            <button className="mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-md border border-slate-200 bg-white text-[14px] font-black transition hover:border-brand hover:text-brand">
              Barcha mashhur yangiliklar <ArrowRight size={17} />
            </button>
          </aside>

          <aside className="rounded-lg bg-ink p-7 text-white news-shadow">
            <div className="flex gap-5">
              <span className="grid size-[58px] shrink-0 place-items-center rounded-full bg-white/10"><Send size={28} fill="white" /></span>
              <div>
                <h3 className="text-[18px] font-black leading-snug">Yangiliklarni o'tkazib yubormang!</h3>
                <p className="mt-3 text-[15px] leading-6 text-slate-100">Eng muhim xabarlar emailingizga yuboriladi.</p>
              </div>
            </div>
            <div className="mt-6 flex overflow-hidden rounded-md border border-white/20">
              <input className="h-11 min-w-0 flex-1 bg-transparent px-4 text-[14px] outline-none placeholder:text-slate-300" placeholder="Email manzilingiz" />
              <button className="h-11 bg-brand px-5 text-[14px] font-black">Obuna bo'lish</button>
            </div>
          </aside>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-[27px] font-black">So'nggi yangiliklar</h2>
            {["Barchasi", "O'zbekiston", "Dunyo", "Siyosat", "Iqtisodiyot", "Texnologiya", "Sport", "Madaniyat"].map((item, index) => (
              <button key={item} className={`h-9 rounded-full border px-4 text-[13px] font-bold transition ${index === 0 ? "border-brand bg-brand text-white shadow-lg shadow-blue-500/20" : "border-slate-200 bg-white text-ink hover:border-brand hover:text-brand"}`}>{item}</button>
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
            <h2 className="text-2xl font-black">Jahon <span className="text-brand">Xabarlari</span></h2>
            <p className="mt-4 text-slate-300">Dunyodagi eng muhim voqealarni tez, ishonchli va xolis ravishda yetkazib beramiz.</p>
          </div>
          <div><h3 className="font-black">Bo'limlar</h3><p className="mt-4 text-slate-300">Dunyo<br />O'zbekiston<br />Siyosat<br />Texnologiya</p></div>
          <div><h3 className="font-black">Foydali havolalar</h3><p className="mt-4 text-slate-300">Biz haqimizda<br />Aloqa<br />Reklama<br />Maxfiylik siyosati</p></div>
          <div><h3 className="font-black">Bog'lanish</h3><p className="mt-4 text-slate-300">info@jahonxabarlari.uz<br />Toshkent, O'zbekiston</p></div>
        </div>
      </footer>
    </main>
  );
}
