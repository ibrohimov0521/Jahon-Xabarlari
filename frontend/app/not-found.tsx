import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Header } from "../components/Header";

export default function NotFound() {
  return (
    <main>
      <Header />
      <section className="container-page py-16">
        <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-10 text-center news-shadow">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-blue-50 text-brand">
            <FileQuestion size={30} />
          </span>
          <h1 className="mt-5 text-3xl font-black">Sahifa topilmadi</h1>
          <p className="mx-auto mt-3 max-w-md text-slate-500">
            Siz izlagan maqola yoki sahifa mavjud emas, o'chirilgan bo'lishi yoki manzil noto'g'ri kiritilgan bo'lishi mumkin.
          </p>
          <Link href="/" className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-brand px-5 font-black text-white">
            Bosh sahifaga qaytish
          </Link>
        </div>
      </section>
    </main>
  );
}
