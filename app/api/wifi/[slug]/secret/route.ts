import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decryptSecret } from "@/lib/crypto";

const privateHeaders = { "Cache-Control": "no-store, private", "Pragma": "no-cache" };

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { data, error } = await supabaseAdmin
      .from("wifi_cards")
      .select("id,status,wifi_networks!inner(encrypted_password,security_type)")
      .eq("slug", slug)
      .eq("status", "active")
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, data: null, error: "WiFi card not found" },
        { status: 404, headers: privateHeaders });
    }
    const network = Array.isArray(data.wifi_networks) ? data.wifi_networks[0] : data.wifi_networks;
    if (!network) {
      return NextResponse.json({ success: false, data: null, error: "WiFi network not found" },
        { status: 404, headers: privateHeaders });
    }
    const password = network.security_type === "Open"
      ? "" : decryptSecret(network.encrypted_password);
    return NextResponse.json({ success: true, data: { password }, error: null },
      { headers: privateHeaders });
  } catch (error) {
    console.error("WiV1 WiFi secret error", error);
    return NextResponse.json({ success: false, data: null, error: "WiFi credentials unavailable" },
      { status: 503, headers: privateHeaders });
  }
}
