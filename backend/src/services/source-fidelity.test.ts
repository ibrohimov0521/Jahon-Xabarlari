import assert from "node:assert/strict";
import test from "node:test";
import { inspectSourceFidelity } from "./source-fidelity.js";

test("unconfirmed military claim cannot be upgraded to a confirmed fact", () => {
  const result = inspectSourceFidelity({
    sourceTitle: "O'zbekiston Xitoydan harbiy samolyotlar sotib olyaptimi?",
    sourceText: "J-10CE samolyotlari qo'shilgani haqida xabarlar tarqaldi. Rasmiy Toshkent ham, Pekin ham ma'lumotni tasdiqlagani yo'q.",
    generatedTitle: "O'zbekiston Harbiy-havo kuchlariga J-10CE samolyotlari qo'shildi",
    generatedContent: "Xitoylik kuzatuvchilar ushbu ma'lumotni tasdiqladi.",
    category: "Siyosat",
    confidence: 0.95,
    aiSupported: false,
    aiPreservedUncertainty: false
  });

  assert.equal(result.publishable, false);
  assert.equal(result.highRisk, true);
  assert.ok(result.issues.includes("SOURCE_UNCERTAINTY_REMOVED"));
  assert.ok(result.issues.includes("HIGH_RISK_UNVERIFIED_SOURCE"));
});

test("new numbers and invented quotes are rejected", () => {
  const result = inspectSourceFidelity({
    sourceTitle: "Kompaniya yangi mahsulotni taqdim etdi",
    sourceText: "Mahsulot seshanba kuni namoyish qilindi.",
    generatedTitle: "Kompaniya 12 ta mahsulotni taqdim etdi",
    generatedContent: "Rahbar: “Savdo ikki baravar oshadi”, dedi.",
    confidence: 0.95
  });

  assert.equal(result.publishable, false);
  assert.ok(result.issues.includes("UNSUPPORTED_NUMBER:12"));
  assert.ok(result.issues.includes("UNSUPPORTED_QUOTE"));
});

test("faithful paraphrase that preserves uncertainty passes ordinary checks", () => {
  const result = inspectSourceFidelity({
    sourceTitle: "Yangi xizmat ishga tushirilishi mumkin",
    sourceText: "Kompaniya ma'lumotiga ko'ra, xizmat 2027 yilda ishga tushirilishi ehtimol qilinmoqda.",
    generatedTitle: "Kompaniya 2027 yilda yangi xizmatni ishga tushirishi mumkin",
    generatedContent: "Kompaniya ma'lumotiga ko'ra, yangi xizmat 2027 yilda ishga tushirilishi ehtimol qilinmoqda.",
    confidence: 0.95,
    aiSupported: true,
    aiPreservedUncertainty: true
  });

  assert.equal(result.publishable, true);
  assert.deepEqual(result.issues, []);
});
