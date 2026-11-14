// Preserve the current Preview host so QA QR codes never silently point at production.
// Production may use its configured canonical public URL.
export function wifiCardLandingUrl(slug: string, requestUrl: string, environment: string | undefined, productionBase: string | undefined): string {
  const requestOrigin = new URL(requestUrl).origin;
  let base = requestOrigin;
  if (environment === "production" && productionBase) {
    const production = new URL(productionBase);
    if (production.protocol !== "https:") throw new Error("Production WiFi base must use HTTPS");
    base = production.origin;
  }
  const url = new URL("/wifi/" + encodeURIComponent(slug), base);
  url.searchParams.set("src", "qr");
  return url.toString();
}
