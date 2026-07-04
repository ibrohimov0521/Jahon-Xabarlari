import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Biz haqimizda",
  description: `${SITE_NAME} - O'zbekiston va dunyodagi muhim voqealarni tezkor, ishonchli va xolis yorituvchi yangiliklar portali.`,
  alternates: { canonical: `${SITE_URL}/about` }
};

export default function AboutPage() {
  return (
    <main>
      <Header />
      <section className="container-page max-w-3xl py-10">
        <h1 className="text-3xl font-black">Biz haqimizda</h1>
        <p className="mt-4 text-lg text-slate-600">Jahon Xabarlari O'zbekiston va dunyodagi eng muhim voqealarni tezkor, ishonchli va xolis yoritishga qaratilgan professional yangiliklar portalidir.</p>
      </section>
    </main>
  );
}
