import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data, error } = await supabaseAdmin
    .from("wifi_cards")
    .select(`
      id, business_id, location_id, card_code, slug, status,
      businesses!inner(name, logo_url),
      wifi_networks!inner(ssid, security_type, instructions)
    `)
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, data: null, error: "WiFi card not found" }, { status: 404 });
  }

  const business = Array.isArray(data.businesses) ? data.businesses[0] : data.businesses;
  const network = Array.isArray(data.wifi_networks) ? data.wifi_networks[0] : data.wifi_networks;

  return NextResponse.json({
    success: true,
    data: {
      id: data.id,
      business_id: data.business_id,
      location_id: data.location_id,
      card_code: data.card_code,
      slug: data.slug,
      status: data.status,
      business_name: business?.name ?? "WiFi",
      logo_url: business?.logo_url ?? null,
      ssid: network?.ssid ?? "",
      security_type: network?.security_type ?? "WPA2",
      instructions: network?.instructions ?? null,
    },
    error: null,
  });
}
