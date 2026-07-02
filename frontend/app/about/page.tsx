import { Header } from "../../components/Header";

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
