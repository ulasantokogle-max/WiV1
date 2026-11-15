import test from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "../lib/crypto.ts";
import { isValidProtectedWifiPassword } from "../lib/wifi-validation.ts";
import { classifyWifiVisit } from "../lib/wifi-visit.ts";
import { buildWifiQrPayload } from "../lib/wifi-qr.ts";

test("WPA2/WPA3 passphrase validation rejects unusable credentials", () => {
  assert.equal(isValidProtectedWifiPassword("short"), false);
  assert.equal(isValidProtectedWifiPassword("valid-pass-123"), true);
  assert.equal(isValidProtectedWifiPassword("a".repeat(64)), true);
  assert.equal(isValidProtectedWifiPassword("x".repeat(64).replace("x", "z")), false);
  assert.equal(isValidProtectedWifiPassword(""), false);
});

test("WPA password AES-256-GCM encrypted at rest round-trips into connect QR", () => {
  const secret = "qa-password-123";
  const payload = encryptSecret(secret);
  assert.notEqual(payload, secret);
  assert.equal(payload.split(".").length, 3);
  const recovered = decryptSecret(payload);
  assert.equal(recovered, secret);
  assert.equal(buildWifiQrPayload("WiV1-WPA2-QA", "WPA2", recovered),
    "WIFI:T:WPA;S:WiV1-WPA2-QA;P:qa-password-123;;");
});

test("AES-GCM rejects tampered ciphertext and uses a random IV", () => {
  const a = encryptSecret("sample-password");
  const b = encryptSecret("sample-password");
  assert.notEqual(a, b);
  const parts = a.split(".");
  const tampered = parts[0] + "." + parts[1] + "." + Buffer.from("tampered").toString("base64url");
  assert.throws(() => decryptSecret(tampered));
});

test("URL source tags distinguish NFC, card QR and direct visits", () => {
  assert.deepEqual(classifyWifiVisit("qr"), { source: "qr", eventType: "qr_scan" });
  assert.deepEqual(classifyWifiVisit("nfc"), { source: "nfc", eventType: "nfc_scan" });
  assert.deepEqual(classifyWifiVisit(null), { source: "direct", eventType: "page_view" });
  assert.deepEqual(classifyWifiVisit("fake"), { source: "direct", eventType: "page_view" });
});
