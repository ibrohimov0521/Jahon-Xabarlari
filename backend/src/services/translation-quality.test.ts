import assert from "node:assert/strict";
import test from "node:test";
import { inspectTranslationQuality } from "./translation-quality.js";

const source = {
  title: "Toshkentda yangi loyiha ishga tushirildi",
  content:
    "Toshkentda yangi loyiha ishga tushirildi. Rasmiylar uning asosiy vazifalarini tushuntirdi. Loyiha aholiga qulay xizmat ko'rsatishga yordam beradi."
};

test("valid English translation passes", () => {
  const result = inspectTranslationQuality(
    source,
    {
      title: "A new project was launched in Tashkent",
      content:
        "A new project has been launched in Tashkent. Officials explained its main objectives. The project will help provide convenient services to residents."
    },
    "en"
  );
  assert.equal(result.valid, true);
});

test("unchanged or wrong-script translation is rejected", () => {
  const unchanged = inspectTranslationQuality(source, source, "en");
  const wrongScript = inspectTranslationQuality(
    source,
    {
      title: "A new project was launched in Tashkent",
      content: "В Ташкенте запущен новый проект, о целях которого подробно рассказали официальные лица и специалисты."
    },
    "en"
  );
  assert.equal(unchanged.valid, false);
  assert.ok(unchanged.issues.includes("NOT_TRANSLATED"));
  assert.equal(wrongScript.valid, false);
  assert.ok(wrongScript.issues.includes("WRONG_ENGLISH_SCRIPT"));
});
