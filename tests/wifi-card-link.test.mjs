import test from "node:test";
import assert from "node:assert/strict";
import { wifiCardLandingUrl } from "../lib/wifi-card-link.ts";

test("Preview QR stays on its own preview host even when production base is configured", () => {
  const url = wifiCardLandingUrl("wiv1-test-001",
    "https://wi-v1-branch-mjh10.vercel.app/api/qr/wiv1-test-001", "preview", "https://wifi.example.com");
  assert.equal(url,"https://wi-v1-branch-mjh10.vercel.app/wifi/wiv1-test-001?src=qr");
});

test("Production QR can use the canonical production origin", () => {
  assert.equal(wifiCardLandingUrl("qa-card",
    "https://wi-v1-deploy.vercel.app/api/qr/qa-card", "production", "https://wifi.example.com"),
    "https://wifi.example.com/wifi/qa-card?src=qr");
});

test("Missing production base falls back to current request origin", () => {
  assert.equal(wifiCardLandingUrl("qa-card", "https://wi-v1.vercel.app/api/qr/qa-card", "production", undefined),
    "https://wi-v1.vercel.app/wifi/qa-card?src=qr");
});

test("Slug is safely escaped in URL", () => {
  assert.equal(wifiCardLandingUrl("a/b", "https://preview.vercel.app/api/qr/a%2Fb", "preview", undefined),
    "https://preview.vercel.app/wifi/a%2Fb?src=qr");
});

test("Production base rejects HTTP", () => {
  assert.throws(() => wifiCardLandingUrl("qa", "https://preview.vercel.app/api/qr/qa", "production", "http://example.com"), /HTTPS/);
});
