import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWiV1Provider, isWiV1BusinessOwned } from "@/lib/wiv1-access";
import { encryptSecret } from "@/lib/crypto";
import { isValidProtectedWifiPassword } from "@/lib/wifi-validation";

const schema = z.object({
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  businessName: z.string().min(2).max(120).optional(),
  locationName: z.string().min(2).max(120).optional(),
  address: z.string().max(300).optional().or(z.literal("")),
  ssid: z.string().min(1).max(100).optional(),
  password: z.string().max(200).optional(),
  securityType: z.enum(["WPA2", "WPA3", "Open"]).optional(),
  instructions: z.string().max(2000).optional().or(z.literal("")),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await requireWiV1Provider())) return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    const { slug } = await params;
    const body = schema.parse(await request.json());
    if (body.securityType !== "Open" && body.password && !isValidProtectedWifiPassword(body.password)) {
      return NextResponse.json({ success: false, data: null, error: "Password WPA2/WPA3 harus 8–63 byte atau 64 digit hex" }, { status: 400 });
    }

    const { data: card, error: cardError } = await supabaseAdmin.from("wifi_cards").select("id,business_id,location_id,slug").eq("slug", slug).maybeSingle();
    if (cardError) throw cardError;
    if (!card) return NextResponse.json({ success: false, data: null, error: "Kartu tidak ditemukan" }, { status: 404 });
    // Once an owner accepts a business, Provider is monitoring-only (V3-style).
    if (await isWiV1BusinessOwned(card.business_id)) {
      return NextResponse.json({ success: false, data: null, error: "Bisnis sudah memiliki owner. Perubahan WiFi hanya melalui Dashboard Client." }, { status: 403 });
    }

    // Open networks must not retain the previous encrypted WPA password.
    // Switching from Open to WPA requires an explicit new password.
    const { data: currentNetwork, error: currentNetworkError } = await supabaseAdmin
      .from("wifi_networks").select("security_type").eq("card_id", card.id).single();
    if (currentNetworkError) throw currentNetworkError;
    if (body.securityType && body.securityType !== "Open" &&
        currentNetwork.security_type === "Open" && !body.password) {
      return NextResponse.json({ success: false, data: null, error: "Password wajib saat mengubah Open ke WPA" }, { status: 400 });
    }

    if (body.status) {
      const { error } = await supabaseAdmin.from("wifi_cards").update({ status: body.status }).eq("id", card.id);
      if (error) throw error;
    }
    if (body.businessName !== undefined) {
      const { error } = await supabaseAdmin.from("businesses").update({ name: body.businessName }).eq("id", card.business_id);
      if (error) throw error;
    }
    if (body.locationName !== undefined || body.address !== undefined) {
      const { error } = await supabaseAdmin.from("locations").update({ ...(body.locationName !== undefined ? { name: body.locationName } : {}), ...(body.address !== undefined ? { address: body.address || null } : {}) }).eq("id", card.location_id);
      if (error) throw error;
    }

    const networkUpdate: Record<string, string | null> = {};
    if (body.ssid !== undefined) networkUpdate.ssid = body.ssid;
    if (body.securityType !== undefined) networkUpdate.security_type = body.securityType;
    if (body.instructions !== undefined) networkUpdate.instructions = body.instructions || null;
    if (body.securityType === "Open") networkUpdate.encrypted_password = encryptSecret("");
    else if (body.password) networkUpdate.encrypted_password = encryptSecret(body.password);
    if (Object.keys(networkUpdate).length) {
      const { error } = await supabaseAdmin.from("wifi_networks").update(networkUpdate).eq("card_id", card.id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, data: { slug }, error: null });
  } catch (error) {
    console.error("WiV1 admin card PATCH", error);
    return NextResponse.json({ success: false, data: null, error: error instanceof z.ZodError ? "Data tidak valid" : "Gagal menyimpan perubahan" }, { status: 400 });
  }
}
