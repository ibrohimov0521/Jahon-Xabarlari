import assert from "node:assert/strict";
import test from "node:test";
import { generateRecoveryCodes, hashRecoveryCode, openTotpSecret, resolveTotpSetupSecret, sealTotpSecret, totpCode, totpUri, verifyTotp } from "./totp.js";

test("TOTP follows the RFC 6238 SHA1 vector truncated to six digits", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totpCode(secret, 59_000), "287082");
  assert.equal(verifyTotp(secret, "287082", 59_000, 0), true);
  assert.equal(verifyTotp(secret, "000000", 59_000, 0), false);
});

test("TOTP URI and recovery codes are stable and non-secret at rest", () => {
  const uri = totpUri("ABCDEF234567", "admin@jahonxabarlari.uz");
  assert.ok(uri.startsWith("otpauth://totp/"));
  const codes = generateRecoveryCodes(4);
  assert.equal(codes.length, 4);
  assert.equal(new Set(codes).size, 4);
  assert.notEqual(hashRecoveryCode(codes[0], "pepper"), codes[0]);
  const sealed = sealTotpSecret("ABCDEF234567", "a sufficiently long encryption key");
  assert.notEqual(sealed, "ABCDEF234567");
  assert.equal(openTotpSecret(sealed, "a sufficiently long encryption key"), "ABCDEF234567");
});

test("pending TOTP setup reuses the same secret instead of rotating it", () => {
  const key = "a-long-encryption-key";
  const original = "ABCDEF234567ABCDEF234567";
  const sealed = sealTotpSecret(original, key);
  const resumed = resolveTotpSetupSecret(sealed, key);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.secret, original);

  const created = resolveTotpSetupSecret(null, key);
  assert.equal(created.resumed, false);
  assert.notEqual(created.secret, original);
});
