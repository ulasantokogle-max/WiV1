// Pure formatting helper for the WiFi QR convention.
// No credentials are logged, cached, or exported outside the requested QR.
export function escapeWifiQrField(value: string): string {
  return value.replace(/([\\;,":])/g, "\\$1");
}

export function buildWifiQrPayload(ssid: string, securityType: "Open" | "WPA2" | "WPA3", password: string): string {
  const safeSsid = escapeWifiQrField(ssid);
  if (securityType === "Open") {
    return `WIFI:T:nopass;S:${safeSsid};;`;
  }
  if (securityType === "WPA2" || securityType === "WPA3") {
    return `WIFI:T:WPA;S:${safeSsid};P:${escapeWifiQrField(password)};;`;
  }
  throw new Error("Unsupported WiFi security type");
}
