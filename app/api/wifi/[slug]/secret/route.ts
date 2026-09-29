import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decryptSecret } from "@/lib/crypto";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data, error } = await supabaseAdmin
    .from("wifi_cards")
    .select("id, status, wifi_networks!inner(encrypted_password)")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (error || !data) return NextResponse.json({ success: false, data: null, error: "WiFi card not found" }, { status: 404 });
  const network = Array.isArray(data.wifi_networks) ? data.wifi_networks[0] : data.wifi_networks;
  return NextResponse.json({ success: true, data: { password: network?.encrypted_password ? decryptSecret(network.encrypted_password) : "" }, error: null });
}
