import assert from "node:assert/strict";
import test from "node:test";
import { assertPublicUrl, readTextResponse } from "./net-guard.js";

test("readTextResponse returns a response within the byte limit", async () => {
  const response = new Response("BEST TEAM NEWS");
  assert.equal(await readTextResponse(response, 100), "BEST TEAM NEWS");
});

test("readTextResponse rejects declared and streamed oversized bodies", async () => {
  await assert.rejects(
    readTextResponse(new Response("short", { headers: { "content-length": "1000" } }), 100),
    /limitdan katta/
  );
  await assert.rejects(readTextResponse(new Response("x".repeat(101)), 100), /limitdan katta/);
});

test("assertPublicUrl rejects private and disguised local addresses", async () => {
  await assert.rejects(assertPublicUrl("http://127.0.0.1/test"), /Ichki tarmoq/);
  await assert.rejects(assertPublicUrl("http://[::1]/test"), /Ichki tarmoq/);
  await assert.rejects(assertPublicUrl("http://[::ffff:7f00:1]/test"), /Ichki tarmoq/);
  await assert.rejects(assertPublicUrl("http://[fe90::1]/test"), /Ichki tarmoq/);
});
