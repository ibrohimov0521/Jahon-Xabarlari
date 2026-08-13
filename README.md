# BEST TEAM NEWS

Professional yangiliklar portali: Next.js frontend, Express/Prisma backend, PostgreSQL, Redis, admin panel va Telegram Admin Bot.

## Tuzilma

```text
frontend/       Next.js, Tailwind CSS, public site va /admin route
backend/        Express REST API, JWT, RBAC, Prisma/PostgreSQL
telegram-bot/   Python aiogram 3 admin bot, backend API orqali ishlaydi
nginx/          reverse proxy konfiguratsiya namunasi
docker-compose.yml
```

## Ishga tushirish

```bash
cp .env.example .env
docker compose up --build
```

Brauzer:

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api/health
- Admin: http://localhost:3000/admin

## Database migration va seed

Backend konteyneri ishga tushishda mavjud production migratsiyalarni va idempotent
seedni avtomatik bajaradi. Qo'lda takrorlash kerak bo'lsa:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed
```

Test admin:

- Email: `admin@jahonxabarlari.uz`
- Parol: birinchi seed oldidan `.env` ichidagi `ADMIN_PASSWORD` orqali kamida 12 belgili qilib beriladi.
- Production parolini repository yoki hujjatga yozmang; mavjud admin paroli keyingi deploylarda seed tomonidan o'zgartirilmaydi.

## Telegram Admin Bot

`.env` ichida quyidagilarni sozlang:

- `FORWARD_CONCURRENCY=5` bir vaqtda qayta ishlanadigan forwardlar sonini cheklaydi.
- `MEDIA_GROUP_DELAY_SECONDS=2.5` Telegram albomidagi rasmlar to'liq yig'ilishini kutadi.

```env
BOT_TOKEN=123456:telegram_bot_token
BOT_API_BASE=http://backend:4000/api
BOT_ADMIN_IDS=123456789,987654321
BOT_SERVICE_SECRET=backend_bilan_bir_xil_kuchli_maxfiy_qiymat
ADMIN_PANEL_URL=https://jahonxabarlari.uz/admin
```

Bot alohida database yaratmaydi. `/api/auth/telegram-login` orqali backenddan JWT oladi va barcha maqola, izoh, reklama, statistika amallarini backend API orqali bajaradi. Backend har bir muhim amalni role permission va audit log bilan tekshiradi.

Bot menyusi:

- ✍️ Yangi maqola
- 🗞️ Yangiliklar
- 📈 Statistika

Forward qilingan matn, rasm, video va media albomlari tozalanib, AI/fallback
klassifikatsiyadan so'ng `REVIEW` statusida admin panelga yuboriladi.

## Telegram va Instagram nashri

Maqola `PUBLISHED` bo'lganda kanalga avtomatik yuboriladi. Bot orqali qo'shilgan media uchun
Instagram formati tanlanadi: `Instagram Post` faqat rasm, `Instagram Reel` faqat video. Story
funksiyasi yo'q. Rasmga yuqori o'ng burchakda BEST TEAM belgisi yuklash vaqtida qo'shiladi;
avvalgi tashqi rasmlar Telegram yoki Instagramga yuborilganda belgilangan nusxa orqali jo'natiladi.

Instagramni Meta hisob tayyor bo'lgach backend servisiga quyidagilarni kiriting:

```env
INSTAGRAM_POSTING_ENABLED=true
INSTAGRAM_ACCESS_TOKEN=meta_long_lived_access_token
INSTAGRAM_USER_ID=instagram_professional_account_id
BACKEND_PUBLIC_URL=https://your-public-backend-domain
```

Reel video tepasiga belgi qo'yish `media-renderer` xizmati bilan bajariladi. U ffmpeg ishini
asosiy API dan alohida bajaradi, shuning uchun katta video tahririyat, bot yoki agregatorni
qotirmaydi. `MEDIA_RENDERER_URL` hamda bir xil `MEDIA_RENDERER_SECRET` qiymatini backend va
renderer xizmatiga kiriting.

Dokploy compose ichida `media-renderer` alohida servis sifatida ishlaydi. Dockerfile manzili
`media-renderer/Dockerfile`, build context esa `./media-renderer` bo'lsin. Rendererga
`BACKEND_PUBLIC_URL` va `MEDIA_RENDERER_SECRET` beriladi; uning public HTTPS manzili backenddagi
`MEDIA_RENDERER_URL` bo'ladi. U bir vaqtda bitta videoni qayta ishlaydi.

## Muhim endpointlar

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `GET /api/articles`
- `GET /api/articles/:slug`
- `POST /api/admin/articles`
- `PUT /api/admin/articles/:id`
- `DELETE /api/admin/articles/:id`
- `PATCH /api/admin/articles/:id/restore`
- `PATCH /api/admin/articles/:id/status`
- `GET /api/admin/dashboard/stats`

## Production eslatmasi

Media hozir PostgreSQL orqali saqlanadi. Hajm va trafik oshganda S3 yoki Cloudflare
R2 ga ko'chirish tavsiya etiladi. Deploydan oldin `docs/OPERATIONS.md` dagi test,
backup va secret talablarini bajaring.
