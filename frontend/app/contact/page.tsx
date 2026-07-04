import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Aloqa",
  description: `${SITE_NAME} tahririyati bilan bog'lanish va murojaat yuborish uchun aloqa ma'lumotlari.`,
  alternates: { canonical: `${SITE_URL}/contact` }
};

export default function ContactPage() {
  return (
    <main>
      <Header />
      <section className="container-page max-w-3xl py-10">
        <div className="rounded-lg border border-slate-200 bg-white p-6 news-shadow">
        <h1 className="text-3xl font-black">Aloqa</h1>
        <p className="mt-4 text-lg text-slate-600">Tahririyat: info@jahonxabarlari.uz</p>
        </div>
      </section>
    </main>
  );
}
