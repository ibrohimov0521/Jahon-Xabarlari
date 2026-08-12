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

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@jahonxabarlari.uz";
  const telegramIds = process.env.BOT_ADMIN_IDS?.split(",").map((item) => item.trim());

  async function upsertManagedUser(input: {
    email: string;
    name: string;
    roleId: string;
    password?: string;
    telegramId?: string;
    required?: boolean;
  }) {
    const [existingByEmail, existingByTelegram] = await Promise.all([
      prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
      input.telegramId
        ? prisma.user.findUnique({ where: { telegramId: input.telegramId }, select: { id: true } })
        : Promise.resolve(null)
    ]);
    if (existingByEmail && existingByTelegram && existingByEmail.id !== existingByTelegram.id) {
      throw new Error(`Admin email va Telegram ID ikki xil foydalanuvchiga tegishli: ${input.email}`);
    }
    const existing = existingByEmail ?? existingByTelegram;
    if (existing) {
      // A rebranded managed account may still be found by Telegram ID. Migrate its
      // initial credentials once, but never replace a password changed in the panel.
      const isIdentityMigration = !existingByEmail && Boolean(existingByTelegram);
      const passwordHash = isIdentityMigration && input.password ? await bcrypt.hash(input.password, 12) : undefined;
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          email: input.email,
          roleId: input.roleId,
          ...(input.telegramId ? { telegramId: input.telegramId } : {}),
          ...(passwordHash ? { passwordHash } : {})
        }
      });
      return;
    }
    if (!input.password || input.password.length < 12) {
      if (input.required === false) {
        console.warn(`${input.email} yaratilmadi: EDITOR_PASSWORD kamida 12 belgidan iborat emas`);
        return;
      }
      throw new Error(`${input.email} uchun kamida 12 belgili parol ENV orqali berilishi kerak`);
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        roleId: input.roleId,
        passwordHash,
        telegramId: input.telegramId
      }
    });
  }

  await upsertManagedUser({
    name: "Super Admin",
    email: adminEmail,
    roleId: superAdminRole.id,
    password: process.env.ADMIN_PASSWORD,
    telegramId: telegramIds?.[0]
  });
  await upsertManagedUser({
    name: "Muharrir",
    email: "editor@jahonxabarlari.uz",
    roleId: editorRole.id,
    password: process.env.EDITOR_PASSWORD,
    telegramId: telegramIds?.[1],
    required: false
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

    const demoAds = [
      { title: "Header banner", placement: "HOME_BANNER", showOnMobile: true, status: AdvertisementStatus.ACTIVE },
      { title: "Sidebar promo", placement: "HOME_SIDEBAR", showOnMobile: false, status: AdvertisementStatus.PAUSED }
    ];
    for (const ad of demoAds) {
      const existing = await prisma.advertisement.findFirst({ where: { title: ad.title, placement: ad.placement } });
      if (!existing) await prisma.advertisement.create({ data: ad });
    }
  }
}

main().finally(() => prisma.$disconnect());
