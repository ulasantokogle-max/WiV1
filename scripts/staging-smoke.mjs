#!/usr/bin/env node
// Read-only WiV1 preview smoke test. Never writes to application data.
const raw = process.env.WIV1_STAGING_BASE_URL;
if (!raw) {
  console.error("Set WIV1_STAGING_BASE_URL to the isolated WiV1 preview URL.");
  process.exit(2);
}
let base;
try {
  base = new URL(raw);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new Error("Expected a clean HTTPS origin");
  }
  const allowed = base.hostname === "localhost" || base.hostname.endsWith(".vercel.app");
  if (!allowed || base.pathname !== "/") throw new Error("Only isolated Vercel preview origins are accepted");
} catch (error) {
  console.error("Invalid preview URL:", error.message);
  process.exit(2);
}
const suffix = "qa-missing-" + Date.now().toString(36);
const checks = [
  { path: "/", status: 200, label: "Homepage" },
  { path: "/api/wifi/" + suffix, status: 404, label: "Unknown WiFi card" },
  { path: "/api/wifi/" + suffix + "/secret", status: 404, label: "Unknown WiFi secret" },
  { path: "/api/admin/cards", status: 401, label: "Admin authorization" },
];
let failures = 0;
for (const check of checks) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(new URL(check.path, base), {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "WiV1-V0.6-Staging-Smoke/1.0" },
    });
    const ok = response.status === check.status;
    console.log(`${ok ? "PASS" : "FAIL"} ${check.label}: HTTP ${response.status} (expected ${check.status})`);
    if (!ok) failures++;
    if (check.path.endsWith("/secret")) {
      const cache = response.headers.get("cache-control") || "";
      const privateNoStore = /no-store/i.test(cache);
      console.log(`${privateNoStore ? "PASS" : "FAIL"} Secret cache policy: ${cache || "(missing)"}`);
      if (!privateNoStore) failures++;
    }
  } catch (error) {
    failures++;
    console.error(`FAIL ${check.label}: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}
if (failures) {
  console.error(`WiV1 staging smoke checks failed: ${failures}`);
  process.exit(1);
}
console.log("WiV1 preview smoke checks passed (read-only; no card created).");
