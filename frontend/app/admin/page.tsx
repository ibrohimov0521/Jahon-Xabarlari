import { BarChart3, FileText, MessageCircle, Newspaper, Settings, ShieldCheck } from "lucide-react";

const cards = [
  ["Jami yangiliklar", "1 284", Newspaper],
  ["Bugun qo'shildi", "42", FileText],
  ["Jami ko'rishlar", "8.6M", BarChart3],
  ["Review", "16", ShieldCheck]
];

export default function AdminPage() {
  return (
    <main className="flex min-h-screen bg-slate-100 text-ink">
      <aside className="hidden w-72 bg-ink p-6 text-white lg:block">
        <h1 className="text-2xl font-black">Jahon <span className="text-brand">Admin</span></h1>
        <nav className="mt-8 space-y-2">
          {["Dashboard", "Yangiliklar", "Yangi maqola", "Kategoriyalar", "Mualliflar", "Media", "Reklama", "Izohlar", "Statistika", "Sozlamalar", "Foydalanuvchilar"].map((item) => (
            <a className="block rounded-md px-4 py-3 font-semibold hover:bg-white/10" key={item}>{item}</a>
          ))}
        </nav>
      </aside>
      <section className="flex-1">
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <h2 className="text-xl font-black">Dashboard</h2>
          <Settings />
        </header>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-4">
            {cards.map(([label, value, Icon]) => (
              <div key={label as string} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <Icon className="text-brand" />
                <p className="mt-5 text-sm text-slate-500">{label as string}</p>
                <strong className="text-3xl">{value as string}</strong>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black">Yangiliklar jadvali</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50"><tr><th className="p-3">Sarlavha</th><th>Status</th><th>Ko'rish</th><th>Amal</th></tr></thead>
                <tbody>
                  {["Draft maqola", "Review maqola", "Published maqola"].map((item, i) => (
                    <tr className="border-t" key={item}><td className="p-3 font-bold">{item}</td><td>{["Draft", "Review", "Published"][i]}</td><td>{2400 + i * 900}</td><td><button className="rounded-md bg-brand px-3 py-2 text-white">Edit</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><MessageCircle className="text-brand" /><h3 className="mt-4 font-black">Izohlar moderatsiyasi</h3></div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><BarChart3 className="text-brand" /><h3 className="mt-4 font-black">Telegram bot statistikasi backend API orqali ishlaydi</h3></div>
          </div>
        </div>
      </section>
    </main>
  );
}
