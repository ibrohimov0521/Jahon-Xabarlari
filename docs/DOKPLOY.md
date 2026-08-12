# Dokploy production ko'chirish

Bu loyiha Dokploy'da bitta **Docker Compose** sifatida ishlaydi. Compose fayli:
`docker-compose.dokploy.yml`.

## 1. Railway ma'lumotlarini saqlash

1. PostgreSQL 16 client (`pg_dump` va `pg_restore`) hamda Railway CLI o'rnatilgan kompyuterda
   `powershell -ExecutionPolicy Bypass -File scripts/backup-railway.ps1` buyrug'ini bajaring.
2. `backups/railway-production.dump` faylini kamida yana bitta xavfsiz diskka nusxalang.
3. Railway servislaridagi maxfiy ENV qiymatlarini Dokploy uchun alohida parol menejeriga eksport qiling.

## 2. Dokploy Compose yaratish

1. Project ichida **Docker Compose** yarating.
2. Provider sifatida GitHub, repository sifatida `ibrohimov0521/Jahon-Xabarlari`, branch sifatida `main` ni tanlang.
3. Compose path: `docker-compose.dokploy.yml`.
4. Isolated Deployments'ni yoqmang: fayl public servislar uchun Dokploy network'ini aniq ulaydi.
5. Environment oynasiga `.env.dokploy.example` asosidagi qiymatlarni kiriting. Railway'dagi real token va
   kalitlarni ko'chiring, lekin `DATABASE_URL`, public URL'lar va ichki Redis/Bot URL'larini shablondagidek qoldiring.

## 3. Dastlabki domenlar

Dokploy **Domains** oynasida quyidagilarni qo'shing va keyin Compose'ni qayta deploy qiling:

| Host | Service | Container port | HTTPS |
| --- | --- | ---: | --- |
| `api.jahonxabarlari.uz` | `backend` | 4000 | Ha |
| `media.jahonxabarlari.uz` | `media-renderer` | 8080 | Ha |

Frontend'ni avval Dokploy vaqtinchalik domenida tekshiring. Baza ko'chirilgach `jahonxabarlari.uz` hostini
`frontend` servisining 3000-portiga ulang.

Cloudflare'da `api`, `media` va yakunda apex domen Dokploy server IP manziliga qarashi kerak. Ko'chirish
paytida DNS yozuvlarini vaqtincha **DNS only** holatida tekshirish diagnostikani osonlashtiradi.

## 4. Bazani tiklash

1. Dump faylini SSH/SCP orqali Dokploy serveriga yuklang.
2. Repository yoki ushbu skript nusxasi serverda mavjud bo'lgan joydan
   `sh scripts/restore-dokploy.sh /path/railway-production.dump` ni bajaring.
3. Dokploy'da Compose'ni qayta deploy qiling.

PostgreSQL bazasida maqolalar, foydalanuvchilar, sozlamalar va yuklangan media fayllar saqlanadi. Redis navbati
ko'chirilmaydi; u vaqtinchalik holat bo'lib, yangi serverda toza boshlanishi xavfsizroq.

## 5. Ishga tushirishdan oldingi tekshiruv

- `https://api.jahonxabarlari.uz/api/health` javobi database va Redis uchun `up` qaytarsin.
- Frontend bosh sahifa, maqola, qidiruv va admin login ishlasin.
- Telegram bot `/start` ga javob bersin va admin amali API'ga yetsin.
- Media renderer `/healthz` javob bersin.
- Bitta test maqola orqali Telegram va Instagram navbatlari tekshirilsin.
- Dokploy'da PostgreSQL named volume uchun kunlik backup va kamida 7 kun retention sozlang.

Tekshiruv tugamaguncha Railway servislarini o'chirmang. DNS almashtirilgandan keyin ham 24-48 soat eski servisni
zaxira sifatida saqlang.
