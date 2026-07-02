import { ChevronDown, Menu, Moon, Search, Send } from "lucide-react";
import Link from "next/link";

const nav = ["Bosh sahifa", "O'zbekiston", "Dunyo", "Siyosat", "Iqtisodiyot", "Texnologiya", "Sport", "Madaniyat"];

export function Header() {
  return (
    <>
      <div className="bg-ink text-white">
        <div className="container-page flex h-10 items-center justify-between text-sm">
          <div className="flex items-center gap-8">
            <span>Toshkent&nbsp;&nbsp; 22C 🌤️</span>
            <span>12 May, 2025&nbsp; Dushanba</span>
          </div>
          <div className="flex items-center gap-7">
            <Link href="/about">Biz haqimizda</Link>
            <Link href="/ads">Reklama</Link>
            <Link href="/contact">Aloqa</Link>
            <div className="hidden items-center gap-4 lg:flex">
              <span className="grid size-5 place-items-center rounded-full bg-sky-500"><Send size={12} fill="white" /></span>
              <span className="grid size-5 place-items-center rounded-full bg-blue-600 text-xs font-black">f</span>
              <span className="grid size-5 place-items-center rounded-full bg-rose-500 text-[10px] font-black">◎</span>
              <span className="grid size-5 place-items-center rounded-full bg-red-700 text-[10px] font-black">▶</span>
            </div>
            <span className="flex items-center gap-1">UZ <ChevronDown size={14} /></span>
          </div>
        </div>
      </div>
      <header className="border-b border-slate-200 bg-white">
        <div className="container-page flex h-20 items-center gap-7">
          <Link href="/" className="mr-8 text-[31px] font-black tracking-normal text-ink">
            Jahon <span className="text-brand">Xabarlari</span>
          </Link>
          <nav className="hidden h-full flex-1 items-center gap-8 text-[15px] font-bold lg:flex">
            {nav.map((item, index) => (
              <Link key={item} className={`flex h-full items-center border-b-2 ${index === 0 ? "border-brand text-brand" : "border-transparent text-ink"}`} href={index === 0 ? "/" : `/category/${item.toLowerCase().replaceAll("'", "").replaceAll(" ", "-")}`}>
                {item}
              </Link>
            ))}
            <button className="flex h-full items-center gap-2 border-b-2 border-transparent font-bold">Ko'proq <Menu size={18} /></button>
          </nav>
          <button aria-label="Qidiruv" className="grid size-11 place-items-center rounded-full hover:bg-slate-100"><Search size={25} strokeWidth={2.2} /></button>
          <button aria-label="Dark mode" className="grid size-11 place-items-center rounded-full bg-ink text-white shadow-lg"><Moon size={21} fill="white" /></button>
          <button aria-label="Menu" className="grid size-10 place-items-center rounded-full lg:hidden"><Menu /></button>
        </div>
      </header>
    </>
  );
}
