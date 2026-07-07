# Jahon Xabarlari

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
docker compose up --build.
```

Brauzer:

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api/health
- Admin: http://localhost:3000/admin

## Database migration va seed

Docker konteynerlar ishga tushgandan keyin:

```bash
docker compose exec backend npx prisma migrate dev --name init
docker compose exec backend npm run prisma:seed
```

Test admin:

- Email: `admin@jahonxabarlari.uz`
- Parol: `Admin12345!`

## Telegram Admin Bot

`.env` ichida quyidagilarni sozlang:

```env
BOT_TOKEN=123456:telegram_bot_token
BOT_API_BASE=http://backend:4000/api
BOT_ADMIN_IDS=123456789,987654321
```

Bot alohida database yaratmaydi. `/api/auth/telegram-login` orqali backenddan JWT oladi va barcha maqola, izoh, reklama, statistika amallarini backend API orqali bajaradi. Backend har bir muhim amalni role permission va audit log bilan tekshiradi.

Bot menyusi:

- 📰 Yangiliklar
- ➕ Yangi maqola
- 📝 Draftlar
- ✅ Review
- 🔥 Breaking
- ⭐ Featured
- 📊 Statistika
- 💬 Izohlar
- 📢 Reklama
- ⚙️ Sozlamalar

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

## Keyingi production ishlari

- S3 yoki Cloudflare R2 adapterini `media` moduliga ulash.
- Admin login UI ni backend JWT bilan bog'lash.
- Rich text editor va media kutubxona UI ni to'liq CRUD qilish.
- Redis cache middleware qo'shish.
- 2FA uchun TOTP modulini yoqish.
