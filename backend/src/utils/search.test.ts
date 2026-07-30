import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicArticleSearchWhere } from "./search.js";

test("empty search omits expensive text contains filters", () => {
  const where = buildPublicArticleSearchWhere({ q: "", lang: "uz" });

  assert.deepEqual(where, { deletedAt: null, status: "PUBLISHED" });
  assert.equal(JSON.stringify(where).includes("contains"), false);
});

test("category filter includes primary and extra categories", () => {
  const where = buildPublicArticleSearchWhere({ q: "", categoryId: "category-1" });

  assert.deepEqual(where.AND, [
    { OR: [{ categoryId: "category-1" }, { extraCategoryIds: { has: "category-1" } }] }
  ]);
});

test("translated search checks original and ready translated content", () => {
  const where = buildPublicArticleSearchWhere({ q: "economy", lang: "en" });
  const serialized = JSON.stringify(where);

  assert.match(serialized, /"title":\{"contains":"economy"/);
  assert.match(serialized, /"translations"/);
  assert.match(serialized, /"status":"READY"/);
  assert.match(serialized, /"lang":"en"/);
});
