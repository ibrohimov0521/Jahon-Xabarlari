import assert from "node:assert/strict";
import test from "node:test";
import { daysAgoFromTashkentDay, startOfTashkentDay } from "./time.js";

test("startOfTashkentDay follows the UTC+5 calendar boundary", () => {
  assert.equal(startOfTashkentDay(new Date("2026-07-13T18:59:59Z")).toISOString(), "2026-07-12T19:00:00.000Z");
  assert.equal(startOfTashkentDay(new Date("2026-07-13T19:00:00Z")).toISOString(), "2026-07-13T19:00:00.000Z");
});

test("daysAgoFromTashkentDay returns whole local calendar days", () => {
  assert.equal(daysAgoFromTashkentDay(3, new Date("2026-07-13T20:00:00Z")).toISOString(), "2026-07-10T19:00:00.000Z");
});
