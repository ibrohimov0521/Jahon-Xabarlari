import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = { title: "Tuzatishlar siyosati", description: `${SITE_NAME} maqolalardagi xatolarni tuzatish tartibi.`, alternates: { canonical: `${SITE_URL}/corrections` } };

export default function CorrectionsPage() {
  return <main><Header /><section className="container-page max-w-3xl py-10"><article className="rounded-lg border border-slate-200 bg-white p-6 news-shadow sm:p-8"><h1 className="text-3xl font-black">Tuzatishlar siyosati</h1><div className="mt-5 grid gap-4 text-base leading-7 text-slate-600"><p>Fakt, imlo yoki kontekst xatosini ko'rsangiz, maqoladagi <strong>“Xato haqida”</strong> tugmasi orqali tahririyatga yuboring.</p><p>Muhim mazmuniy xato tasdiqlansa, maqola yangilanadi va “oxirgi yangilangan” vaqti o'zgaradi. Materialning asosiy xulosasini o'zgartiradigan tuzatishlar ochiq qayd etiladi.</p><p>Mualliflik huquqi bo'yicha murojaatlar uchun info@jahonxabarlari.uz manziliga dalillar bilan yozing.</p></div></article></section></main>;
}
