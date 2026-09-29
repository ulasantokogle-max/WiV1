import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";
import { encryptSecret } from "@/lib/crypto";

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

async function requireAdmin() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: admin } = await supabaseAdmin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  return admin ? user : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    const { slug } = await params;
    const body = schema.parse(await request.json());

    const { data: card, error: cardError } = await supabaseAdmin.from("wifi_cards").select("id,business_id,location_id,slug").eq("slug", slug).maybeSingle();
    if (cardError) throw cardError;
    if (!card) return NextResponse.json({ success: false, data: null, error: "Kartu tidak ditemukan" }, { status: 404 });

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
    if (body.password) networkUpdate.encrypted_password = encryptSecret(body.password);
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
