// Browser-independent visit attribution; QR link and NFC link use distinct source tags.
// Attribution measures how the page was opened, not proof of a physical NFC tap.
export function classifyWifiVisit(querySource: string | null): {
  source: "qr" | "nfc" | "direct";
  eventType: "qr_scan" | "nfc_scan" | "page_view";
} {
  if (querySource === "qr") return { source: "qr", eventType: "qr_scan" };
  if (querySource === "nfc") return { source: "nfc", eventType: "nfc_scan" };
  return { source: "direct", eventType: "page_view" };
}
