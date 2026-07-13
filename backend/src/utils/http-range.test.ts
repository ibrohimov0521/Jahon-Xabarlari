import assert from "node:assert/strict";
import test from "node:test";
import { parseByteRange } from "./http-range.js";

test("parseByteRange supports explicit, open and suffix byte ranges", () => {
  assert.deepEqual(parseByteRange("bytes=10-19", 100), { start: 10, end: 19 });
  assert.deepEqual(parseByteRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-10", 100), { start: 90, end: 99 });
});

test("parseByteRange rejects malformed and unsatisfiable ranges", () => {
  assert.equal(parseByteRange("bytes=100-120", 100), null);
  assert.equal(parseByteRange("bytes=20-10", 100), null);
  assert.equal(parseByteRange("bytes=0-1,5-6", 100), null);
  assert.equal(parseByteRange("items=0-10", 100), null);
});
