import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = { title: "Tahririyat siyosati", description: `${SITE_NAME} tahririyat tamoyillari.`, alternates: { canonical: `${SITE_URL}/editorial-policy` } };

export default function EditorialPolicyPage() {
  return <main><Header /><section className="container-page max-w-3xl py-10"><article className="rounded-lg border border-slate-200 bg-white p-6 news-shadow sm:p-8"><h1 className="text-3xl font-black">Tahririyat siyosati</h1><div className="mt-5 grid gap-4 text-base leading-7 text-slate-600"><p>{SITE_NAME} tezkorlikdan oldin aniqlikni ustun qo'yadi. Muhim da'volar imkon qadar birlamchi yoki bir-biridan mustaqil manbalar bilan tekshiriladi.</p><p>Aggregator va sun'iy intellekt materialni saralash, qisqartirish va tarjima qilishga yordam beradi. Avtomatik tayyorlangan maqola sifat tekshiruvidan o'tadi va xavfli holatlarda muharrir tasdig'isiz chop etilmaydi.</p><p>Reklama tahririy materialdan aniq ajratiladi. Manfaatlar to'qnashuvi va homiylik o'quvchidan yashirilmaydi.</p></div></article></section></main>;
}
