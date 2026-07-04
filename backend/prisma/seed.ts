import { PrismaClient, ArticleStatus, AdvertisementStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import slugify from "slugify";

const prisma = new PrismaClient();

const permissions = [
  "dashboard.read",
  "articles.read",
  "articles.create",
  "articles.update",
  "articles.publish",
  "articles.delete",
  "categories.manage",
  "media.manage",
  "comments.manage",
  "ads.manage",
  "users.manage",
  "settings.manage",
  "audit.read"
];

const categories = ["O'zbekiston", "Dunyo", "Siyosat", "Iqtisodiyot", "Texnologiya", "Sport", "Madaniyat"];
const titles = [
  "Yer sayyorasining kelajagi: olimlar muhim ogohlantirish berdi",
  "BMT: Dunyo tinchligi uchun yangi tashabbus",
  "O'zbekiston iqtisodiyoti barqaror o'sishda davom etmoqda",
  "Sun'iy intellekt hayotimizni qanday o'zgartirmoqda?",
  "Toshkentda yangi bog' ochildi",
  "Yevropa Ittifoqi yangi sanksiyalar paketini tasdiqladi",
  "Markaziy bank asosiy stavkani yana pasaytirdi",
  "Real Madrid navbatdagi g'alabasiga erishdi",
  "Madaniyat haftaligi katta qiziqish bilan boshlandi",
  "Texnologiya kompaniyalari yangi standart ustida ishlamoqda"
];

async function main() {
  const superAdminRole = await prisma.role.upsert({
    where: { name: "SUPER_ADMIN" },
    update: {},
    create: { name: "SUPER_ADMIN" }
  });
  const editorRole = await prisma.role.upsert({
    where: { name: "EDITOR" },
    update: {},
    create: { name: "EDITOR" }
  });

  // Upserting per-permission (rather than nested-create-on-role-create) ensures new
  // permission keys reach roles that already existed in the database from earlier deploys.
  for (const key of permissions) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key, roleId: superAdminRole.id } });
  }
  const editorKeys = permissions.filter((key) => key.startsWith("articles") || key === "dashboard.read");
  for (const key of editorKeys) {
    await prisma.permission.upsert({ where: { key: `editor.${key}` }, update: {}, create: { key: `editor.${key}`, roleId: editorRole.id } });
  }

  const role = superAdminRole;
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "Admin12345!", 12);
  await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL ?? "admin@jahonxabarlari.uz" },
    update: { passwordHash, telegramId: process.env.BOT_ADMIN_IDS?.split(",")[0] },
    create: { name: "Super Admin", email: process.env.ADMIN_EMAIL ?? "admin@jahonxabarlari.uz", passwordHash, roleId: role.id, telegramId: process.env.BOT_ADMIN_IDS?.split(",")[0] }
  });
  await prisma.user.upsert({
    where: { email: "editor@jahonxabarlari.uz" },
    update: { passwordHash, telegramId: process.env.BOT_ADMIN_IDS?.split(",")[1] },
    create: { name: "Muharrir", email: "editor@jahonxabarlari.uz", passwordHash, roleId: role.id, telegramId: process.env.BOT_ADMIN_IDS?.split(",")[1] }
  });

  const categoryRows = [];
  for (const name of categories) {
    categoryRows.push(await prisma.category.upsert({
      where: { slug: slugify(name, { lower: true, strict: true }) },
      update: {},
      create: { name, slug: slugify(name, { lower: true, strict: true }) }
    }));
  }

  // Demo articles/ads are only (re-)seeded when explicitly requested. The seed script runs on
  // every backend boot (see Dockerfile CMD), so without this flag, deliberately trashed/deleted
  // demo content would keep reappearing after every deploy.
  if (process.env.SEED_DEMO_CONTENT === "true") {
    const author = await prisma.user.findFirstOrThrow();
    for (let i = 0; i < 20; i += 1) {
      const title = titles[i % titles.length];
      const uniqueTitle = `${title} ${i + 1}`;
      const status = [ArticleStatus.PUBLISHED, ArticleStatus.DRAFT, ArticleStatus.REVIEW, ArticleStatus.ARCHIVED][i % 4];
      await prisma.article.upsert({
        where: { slug: slugify(uniqueTitle, { lower: true, strict: true }) },
        update: {},
        create: {
          title: uniqueTitle,
          slug: slugify(uniqueTitle, { lower: true, strict: true }),
          summary: "Eng muhim voqealar bo'yicha qisqa, aniq va ishonchli sharh.",
          content: "Bu demo maqola Jahon Xabarlari portali uchun yaratilgan. Matn SEO, kategoriya, status va ko'rinish sozlamalarini tekshirish uchun ishlatiladi.",
          mainImage: `https://picsum.photos/seed/jahon-${i}/960/540`,
          categoryId: categoryRows[i % categoryRows.length].id,
          authorId: author.id,
          status,
          isFeatured: i % 5 === 0,
          isBreaking: i % 7 === 0,
          isEditorChoice: i % 6 === 0,
          showOnHome: i % 3 !== 0,
          showInSlider: i < 4,
          showInSidebar: i < 8,
          showInLatest: true,
          showInPopular: i % 2 === 0,
          viewsCount: 1200 + i * 437,
          publishedAt: status === ArticleStatus.PUBLISHED ? new Date() : null
        }
      });
    }

    await prisma.advertisement.createMany({
      data: [
        { title: "Header banner", placement: "header", status: AdvertisementStatus.ACTIVE },
        { title: "Sidebar promo", placement: "sidebar", status: AdvertisementStatus.PAUSED }
      ],
      skipDuplicates: true
    });
  }
}

main().finally(() => prisma.$disconnect());
