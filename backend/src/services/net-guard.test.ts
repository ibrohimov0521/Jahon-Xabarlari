import assert from "node:assert/strict";
import test from "node:test";
import { readTextResponse } from "./net-guard.js";

test("readTextResponse returns a response within the byte limit", async () => {
  const response = new Response("Jahon Xabarlari");
  assert.equal(await readTextResponse(response, 100), "Jahon Xabarlari");
});

test("readTextResponse rejects declared and streamed oversized bodies", async () => {
  await assert.rejects(
    readTextResponse(new Response("short", { headers: { "content-length": "1000" } }), 100),
    /limitdan katta/
  );
  await assert.rejects(readTextResponse(new Response("x".repeat(101)), 100), /limitdan katta/);
});
