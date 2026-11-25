import test from "node:test";
import assert from "node:assert/strict";
import { buildWifiQrPayload, escapeWifiQrField } from "../lib/wifi-qr.ts";

test("Open WiFi has no password field", () => {
  assert.equal(buildWifiQrPayload("WiV1-Guest-Test", "Open", ""), "WIFI:T:nopass;S:WiV1-Guest-Test;;");
});

test("WPA2 encodes SSID and password", () => {
  assert.equal(buildWifiQrPayload("Store WiFi", "WPA2", "example-123"), "WIFI:T:WPA;S:Store WiFi;P:example-123;;");
});

test("WPA3 uses compatible WiFi QR type WPA", () => {
  assert.equal(buildWifiQrPayload("Store", "WPA3", "example-123"), "WIFI:T:WPA;S:Store;P:example-123;;");
});

test("special characters are escaped", () => {
  assert.equal(escapeWifiQrField('a\\b;c:d,e"f'), 'a\\\\b\\;c\\:d\\,e\\"f');
});

test("unsupported security is rejected", () => {
  assert.throws(() => buildWifiQrPayload("Store", "Unknown", ""), /Unsupported/);
});
