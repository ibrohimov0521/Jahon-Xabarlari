import type { Metadata } from "next";
import { Header } from "../../components/Header";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = { title: "Maxfiylik siyosati", description: `${SITE_NAME} foydalanuvchi ma'lumotlari siyosati.`, alternates: { canonical: `${SITE_URL}/privacy` } };

export default function PrivacyPage() {
  return <main><Header /><section className="container-page max-w-3xl py-10"><article className="rounded-lg border border-slate-200 bg-white p-6 news-shadow sm:p-8"><h1 className="text-3xl font-black">Maxfiylik siyosati</h1><div className="mt-5 grid gap-4 text-base leading-7 text-slate-600"><p>Sayt ko'rishlar sonini sun'iy oshirmaslik va suiiste'molni cheklash uchun IP manzil va brauzer ma'lumotidan qayta tiklab bo'lmaydigan texnik hash yaratishi mumkin. Xom IP ko'rishlar jadvalida saqlanmaydi.</p><p>Bildirishnoma yoqilsa, brauzerning push obuna identifikatori saqlanadi. Uni brauzer sozlamalari orqali istalgan payt bekor qilish mumkin.</p><p>Analitika faqat sayt egasi tegishli kalitni yoqqanda ishlaydi va IP anonimlashtiriladi. Izoh yoki xato xabarida email qoldirish ixtiyoriy.</p></div></article></section></main>;
}
