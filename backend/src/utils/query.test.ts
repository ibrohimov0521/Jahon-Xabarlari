import assert from "node:assert/strict";
import test from "node:test";
import { pagination, positiveInt } from "./query.js";

test("positiveInt rejects unsafe and non-positive values", () => {
  assert.equal(positiveInt(undefined, 20, 100), 20);
  assert.equal(positiveInt(0, 20, 100), 20);
  assert.equal(positiveInt("abc", 20, 100), 20);
});

test("positiveInt clamps values to the configured maximum", () => {
  assert.equal(positiveInt("250", 20, 100), 100);
});

test("pagination returns a bounded take and stable offset", () => {
  assert.deepEqual(pagination({ page: "3", limit: "25" }), { page: 3, take: 25, skip: 50 });
  assert.deepEqual(pagination({ page: "bad", limit: "999" }), { page: 1, take: 100, skip: 0 });
});
