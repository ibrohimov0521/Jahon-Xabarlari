import assert from "node:assert/strict";
import test from "node:test";
import { inspectArticleQuality, normalizeArticleTags } from "./article-quality.js";

const goodContent = [
  "Toshkentda yangi loyiha bo'yicha rasmiy ma'lumot e'lon qilindi va uning asosiy bosqichlari tushuntirildi.",
  "Mas'ullar loyiha aholiga qulaylik yaratishi hamda xizmat sifatini oshirishini bildirdi.",
  "Dastlabki ishlar shu oyda boshlanadi va bajarilish jarayoni ochiq ma'lumotlar orqali kuzatib boriladi.",
  "Mutaxassislar yakuniy natijalar bo'yicha qo'shimcha hisobot taqdim etilishini qayd etdi.",
  "Jahon Xabarlari mavzu yuzasidan yangi tafsilotlarni kuzatishda davom etadi."
].join(" ");

test("high-quality Latin Uzbek article can be published", () => {
  const result = inspectArticleQuality({
    title: "Toshkentdagi yangi loyiha tafsilotlari e'lon qilindi",
    content: goodContent,
    sourceUrl: "https://example.com/news",
    mainImage: "https://example.com/images/original-1600.jpg",
    confidence: 0.92
  });
  assert.equal(result.publishable, true);
  assert.equal(result.score, 100);
});

test("short or Cyrillic content is forced to review", () => {
  const result = inspectArticleQuality({
    title: "Qisqa xabar",
    content: "\u0411\u0443 \u0436\u0443\u0434\u0430 \u049b\u0438\u0441\u049b\u0430 \u0445\u0430\u0431\u0430\u0440.",
    sourceUrl: "https://example.com/news",
    mainImage: null,
    confidence: 0.5
  });
  assert.equal(result.publishable, false);
  assert.ok(result.issues.includes("CONTENT_TOO_SHORT"));
  assert.ok(result.issues.includes("LOW_AI_CONFIDENCE"));
});

test("tags are cleaned, deduplicated and bounded", () => {
  assert.deepEqual(normalizeArticleTags([" Sport ", "sport", "#Toshkent", "", 4]), ["Sport", "Toshkent"]);
});
