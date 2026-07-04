import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Reklama",
  description: `${SITE_NAME} portalida reklama joylashtirish imkoniyatlari va hamkorlik uchun ma'lumotlar.`,
  alternates: { canonical: `${SITE_URL}/ads` }
};

export default function AdsPage() {
  return (
    <main>
      <Header />
      <section className="container-page max-w-3xl py-10">
        <h1 className="text-3xl font-black">Reklama</h1>
        <p className="mt-4 text-lg text-slate-600">Portal reklama joylashuvlari backend admin paneli orqali boshqariladi.</p>
      </section>
    </main>
  );
}
