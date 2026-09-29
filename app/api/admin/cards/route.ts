import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";
import { encryptSecret } from "@/lib/crypto";

const schema = z.object({
  businessName: z.string().min(2).max(120),
  locationName: z.string().min(2).max(120),
  address: z.string().max(300).optional().or(z.literal("")),
  cardCode: z.string().regex(/^[A-Z0-9-]{3,40}$/),
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  ssid: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  securityType: z.enum(["WPA2", "WPA3", "Open"]).default("WPA2"),
  instructions: z.string().max(2000).optional().or(z.literal("")),
});

async function requireAdmin() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: admin } = await supabaseAdmin.from("admin_users").select("user_id, role").eq("user_id", user.id).maybeSingle();
  return admin ? { user, role: admin.role } : null;
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });

    const { data: cards, error } = await supabaseAdmin
      .from("wifi_cards")
      .select("id,business_id,location_id,card_code,slug,status,created_at,updated_at,businesses(name,logo_url),locations(name,address),wifi_networks(ssid,security_type)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const cardIds = (cards ?? []).map((card) => card.id);
    let events: Array<{ card_id: string; event_type: string; source: string; created_at: string }> = [];
    if (cardIds.length) {
      const { data, error: eventError } = await supabaseAdmin
        .from("wifi_events")
        .select("card_id,event_type,source,created_at")
        .in("card_id", cardIds)
        .order("created_at", { ascending: false });
      if (eventError) throw eventError;
      events = data ?? [];
    }

    const analytics = Object.fromEntries((cards ?? []).map((card) => {
      const own = events.filter((event) => event.card_id === card.id);
      const count = (type: string) => own.filter((event) => event.event_type === type).length;
      return [card.id, {
        pageViews: count("page_view"),
        qrScans: count("qr_scan"),
        nfcScans: count("nfc_scan"),
        passwordCopies: count("password_copy"),
        lastActivity: own[0]?.created_at ?? null,
      }];
    }));

    return NextResponse.json({ success: true, data: { cards: cards ?? [], analytics }, error: null });
  } catch (error) {
    console.error("WiV1 admin cards GET", error);
    return NextResponse.json({ success: false, data: null, error: "Gagal memuat kartu" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    const body = schema.parse(await request.json());

    const { data: business, error: businessError } = await supabaseAdmin.from("businesses").insert({ name: body.businessName }).select("id").single();
    if (businessError) throw businessError;
    const { data: location, error: locationError } = await supabaseAdmin.from("locations").insert({ business_id: business.id, name: body.locationName, address: body.address || null }).select("id").single();
    if (locationError) throw locationError;
    const { data: card, error: cardError } = await supabaseAdmin.from("wifi_cards").insert({ business_id: business.id, location_id: location.id, card_code: body.cardCode, slug: body.slug, status: "active" }).select("id, card_code, slug, status").single();
    if (cardError) throw cardError;
    const { error: networkError } = await supabaseAdmin.from("wifi_networks").insert({ card_id: card.id, ssid: body.ssid, encrypted_password: encryptSecret(body.password), security_type: body.securityType, instructions: body.instructions || null });
    if (networkError) throw networkError;

    return NextResponse.json({ success: true, data: card, error: null }, { status: 201 });
  } catch (error) {
    console.error("WiV1 admin card create", error);
    const message = error instanceof z.ZodError ? "Data kartu tidak valid" : "Gagal membuat kartu";
    return NextResponse.json({ success: false, data: null, error: message }, { status: 400 });
  }
}
