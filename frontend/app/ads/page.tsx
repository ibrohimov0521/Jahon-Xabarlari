import type { Metadata } from "next";
import { ArrowRight, BarChart3, LayoutPanelTop, Newspaper, PanelRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Header } from "../../components/Header";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Reklama",
  description: `${SITE_NAME} portalida reklama joylashtirish imkoniyatlari va hamkorlik uchun ma'lumotlar.`,
  alternates: { canonical: `${SITE_URL}/ads` }
};

const slots = [
  { icon: <LayoutPanelTop size={21} />, title: "Bosh sahifa banneri", size: "1200 x 180", text: "Asosiy yangiliklar blokidan keyingi yuqori ko'rinish." },
  { icon: <Newspaper size={21} />, title: "Kontent oqimi", size: "1200 x 300", text: "Yangiliklar orasidagi tabiiy va e'tiborli joylashuv." },
  { icon: <PanelRight size={21} />, title: "Desktop yon panel", size: "600 x 750", text: "Ko'p o'qilganlar yonida uzoqroq ko'rinadigan format." },
  { icon: <BarChart3 size={21} />, title: "Maqola joylashuvlari", size: "1200 x 220/300", text: "Maqola ichida yoki o'xshash xabarlardan oldin." }
];

export default function AdsPage() {
  return (
    <main>
      <Header />
      <section className="container-page py-10 text-white sm:py-14">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase text-cyan-300"><ShieldCheck size={15} /> Shaffof hamkorlik</span>
          <h1 className="mt-5 text-3xl font-black text-white sm:text-5xl">Jahon Xabarlarida reklama</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Brendingizni o'quvchiga xalaqit bermaydigan, tahririy kontentdan aniq ajratilgan premium joylashuvlarda ko'rsating.</p>
        </div>
        <div className="mx-auto mt-9 grid max-w-5xl gap-4 sm:grid-cols-2">
          {slots.map((slot) => (
            <article key={slot.title} className="rounded-lg border border-cyan-300/20 bg-[#071827]/90 p-5 shadow-xl backdrop-blur-xl">
              <span className="grid size-10 place-items-center rounded-md bg-brand/15 text-brand">{slot.icon}</span>
              <div className="mt-4 flex items-center justify-between gap-3"><h2 className="text-lg font-black text-white">{slot.title}</h2><span className="shrink-0 rounded-md bg-cyan-400/10 px-2 py-1 text-xs font-black text-cyan-300">{slot.size}</span></div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{slot.text}</p>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-6 flex max-w-5xl flex-col items-start justify-between gap-4 rounded-lg border border-cyan-300/20 bg-[#071827]/90 p-6 sm:flex-row sm:items-center">
          <div><h2 className="text-xl font-black text-white">Media reja va narxlar</h2><p className="mt-1 text-sm text-slate-300">Format, muddat va auditoriyaga mos taklifni birga tanlaymiz.</p></div>
          <Link href="/contact" className="inline-flex h-11 items-center gap-3 rounded-md bg-brand px-5 text-sm font-black text-white transition hover:bg-blue-700">Bog'lanish <ArrowRight size={17} /></Link>
        </div>
      </section>
    </main>
  );
}
