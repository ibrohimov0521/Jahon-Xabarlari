# Keyingi qadamlar (2026-07-10 sessiyasidan)

Bu fayl istalgan qurilmada `git pull` qilib davom ettirish uchun. O'qib/bajarib bo'lgach o'chirish mumkin.

## ⚠️ AVVAL: Railway env sozlamalari (bularsiz backend ishga tushmaydi / bot login qilmaydi)

Xavfsizlik commit'idan (`fe45d9b`) keyin quyidagilar SHART:

1. **`JWT_ACCESS_SECRET`** va **`JWT_REFRESH_SECRET`** — har biri kamida 32 belgi, alohida qiymat.
   `openssl rand -hex 32` bilan yarating. Eski `change_*` yoki qisqa qiymatlar endi rad etiladi
   (backend boot bo'lmaydi).
2. **`BOT_SERVICE_SECRET`** — bir xil qiymatni **ham backend, ham telegram-bot** servisiga qo'ying.
   `openssl rand -hex 24`. Bo'lmasa `/auth/telegram-login` 503/401 qaytaradi va botning admin
   amallari ishlamaydi.

Backend + telegram-bot servislarini env qo'ygandan keyin qayta deploy qiling.

## Bu sessiyada BAJARILDI (main'ga push qilingan)

- **Xavfsizlik**: telegram-login bypass yopildi (shared secret + rate limit); JWT secret'lar
  mustahkamlandi; SSRF guard (`backend/src/services/net-guard.ts`) — agregator ichki/metadata
  IP'larga bora olmaydi; media upload magic-byte tekshiruvi + 25MB cap; refresh token HttpOnly
  cookie'ga ko'chirildi.
- **Admin panel**: `ui.tsx`da umumiy `Button`/`IconButton`/`Textarea`/`Select` primitivlari;
  barcha view'lardagi eskicha tugmalar almashtirildi; CommentsView o'chirishga tasdiq; AdsView
  xato ushlash; ArticlesView status-dropdown Esc/tashqi-bosishda yopiladi + schedule vaqt-mintaqa
  tuzatildi; dublikat "Statistika" menyusi olib tashlandi.
- **Kod tartibi**: `API_URL` (6 nusxa) → `frontend/lib/config.ts`; `isVideoUrl` (2 nusxa) →
  `frontend/lib/media.ts`; agregator manbalari → `backend/src/services/aggregator-sources.ts`.
- **Xatolar**: bosh sahifadagi ikkilanган footer olib tashlandi (SubscribeBox SiteFooter'ga
  ko'chdi); trending endi bugun ko'p o'qilgan eski maqolalarni ham chiqaradi; category sahifasi
  xatoda begona demo maqola ko'rsatmaydi.

Tekshiruv: backend + frontend `tsc` toza, `next build` muvaffaqiyatli.

## HALI QILINMAGAN (ataylab qoldirilgan)

1. **`backend/src/modules/articles/routes.ts` (479 qator) ni modullarga bo'lish** — public
   maqola/izoh endpointlarini ajratish, admin CRUD'ni alohida faylga, `applyTranslation`/sana
   yordamchilarini shared util'ga. Yaqinda xavfsizlik o'zgarishi kirgani uchun beqarorlashtirmaslik
   maqsadida qoldirildi. Bo'lgandan keyin `tsc --noEmit` bilan tekshiring.
2. **`backend/src/services/aggregator.ts` (hali ~520 qator) ni yanada bo'lish** — media-extraction
   yordamchilarini (`tokenize`, `similarity`, `firstMedia`, `bestMedia`, `mediaScore`,
   `extractMetaMedia`, `fetchPageMedia` ...) `aggregator-media.ts`ga, AI dedup/rewrite'ni alohida
   fayllarga. Manbalar ro'yxati allaqachon `aggregator-sources.ts`ga ajratildi.
3. **ESLint sozlash** — hozir umuman yo'q (`eslint-disable` izohlar bor, lekin lint ishlamaydi).
   Frontend: `eslint-config-next` + `lint` script. Backend: flat config + `typescript-eslint`.
   Yangi dependency bo'lgani uchun sizdan so'ramasdan qo'shilmadi.
4. **Admin dark-mode dizayn** — admin panelda `dark:` klasslari yo'q, faqat globals.css'dagi
   global override'larga tayanadi; ba'zi slate-400/700/900 matnlar dark rejimda past kontrast
   berishi mumkin. Semantik rang tokenlari (tailwind.config'da `ink`/`brand`dan tashqari) qo'shish
   va glassmorphism/`!important` shadow'larni admin bilan moslashtirish kerak.
5. **Kichik yaxshilanishlar**: ArticleEditor'da gallery (qo'shimcha rasmlar) tahrirlash yo'q;
   category sahifasida noma'lum slug uchun `notFound()`; ArticleEditor'dagi AI "Qisqa izoh yaratish"
   tugmasi hali maxsus (accent) uslubda — xohlasangiz primitivga o'tkazish mumkin.

## Foydali eslatmalar

- Deploy: main'ga push = Railway avtomatik deploy (backend + frontend + bot alohida servislar).
- Frontend deploy: Railway'da frontend katalogini (repo root emas) link qilish kerak — oldingi
  commit `70694b5`da hujjatlashtirilgan.
- Aggregator ishga tushishi uchun `OPENAI_API_KEY` va `NEWS_AGGREGATOR_ENABLED=true` kerak;
  qo'lda ishga tushirish admin "Agregator" panelidan.
