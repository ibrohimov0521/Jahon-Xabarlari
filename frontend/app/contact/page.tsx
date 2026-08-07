import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Aloqa",
  description: `${SITE_NAME} tahririyatiga Telegram bot orqali murojaat yuboring.`,
  alternates: { canonical: `${SITE_URL}/contact` }
};

export default function ContactPage() {
  return (
    <main>
      <Header />
      <section className="container-page max-w-3xl py-10">
        <div className="rounded-lg border border-slate-200 bg-white p-6 news-shadow sm:p-8">
        <h1 className="text-3xl font-black">Aloqa</h1>
        <p className="mt-4 max-w-xl text-lg leading-7 text-slate-600">Savol, taklif yoki murojaatingizni Telegram botimizga yuboring. Bot telefon raqamingiz va xabaringizni qabul qiladi, tahririyat siz bilan bog'lanadi.</p>
        <a href="https://t.me/BESTteamnewsbot" target="_blank" rel="noreferrer" className="mt-6 inline-flex h-11 items-center rounded-md bg-brand px-5 text-sm font-black text-white transition hover:bg-blue-700">@BESTteamnewsbot ga o'tish</a>
        </div>
      </section>
    </main>
  );
}
