import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decryptSecret } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

// WiFi QR format: WIFI:T:WPA;S:<ssid>;P:<password>;; or WIFI:T:nopass;S:<ssid>;;
function escapeWifiValue(value: string) {
  return value.replace(/([\\;,":])/g, "\\$1");
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { data: card, error } = await supabaseAdmin
      .from("wifi_cards")
      .select("status,wifi_networks!inner(ssid,encrypted_password,security_type)")
      .eq("slug", slug)
      .eq("status", "active")
      .single();

    if (error || !card) {
      return NextResponse.json({ error: "WiFi card not found" }, { status: 404, headers: privateHeaders });
    }
    const network = Array.isArray(card.wifi_networks) ? card.wifi_networks[0] : card.wifi_networks;
    if (!network) {
      return NextResponse.json({ error: "Network not found" }, { status: 404, headers: privateHeaders });
    }
    const open = network.security_type === "Open";
    if (!open && network.security_type !== "WPA2" && network.security_type !== "WPA3") {
      return NextResponse.json({ error: "Unsupported WiFi security" }, { status: 422, headers: privateHeaders });
    }
    const password = open ? "" : decryptSecret(network.encrypted_password);
    const payload = open
      ? `WIFI:T:nopass;S:${escapeWifiValue(network.ssid)};;`
      : `WIFI:T:WPA;S:${escapeWifiValue(network.ssid)};P:${escapeWifiValue(password)};;`;

    const png = await QRCode.toBuffer(payload, { type: "png", width: 520, margin: 2, errorCorrectionLevel: "M" });
    return new NextResponse(Uint8Array.from(png), {
      headers: { ...privateHeaders, "Content-Type": "image/png" },
    });
  } catch (error) {
    console.error("WiV1 connect QR unavailable", error);
    return NextResponse.json({ error: "WiFi QR unavailable" }, { status: 503, headers: privateHeaders });
  }
}
