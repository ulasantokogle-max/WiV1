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
  password: z.string().max(200),
  securityType: z.enum(["WPA2", "WPA3", "Open"]).default("WPA2"),
  instructions: z.string().max(2000).optional().or(z.literal("")),
}).superRefine((value, ctx) => {
  if (value.securityType !== "Open" && !value.password) {
    ctx.addIssue({ code: "custom", path: ["password"], message: "Password wajib untuk WPA2/WPA3" });
  }
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

    // A single Postgres RPC guarantees all four inserts commit or roll back together.
    // Deploy supabase/002_v06_atomic_and_events.sql before using this route.
    const { data: card, error: createError } = await supabaseAdmin.rpc("wiv1_create_card_atomic", {
      p_business_name: body.businessName,
      p_location_name: body.locationName,
      p_address: body.address || "",
      p_card_code: body.cardCode,
      p_slug: body.slug,
      p_ssid: body.ssid,
      p_encrypted_password: encryptSecret(body.securityType === "Open" ? "" : body.password),
      p_security_type: body.securityType,
      p_instructions: body.instructions || "",
    });
    if (createError) {
      // 23505 is a PostgreSQL unique violation (card code or slug).
      if (createError.code === "23505") {
        return NextResponse.json({ success: false, data: null, error: "Kode kartu atau slug sudah digunakan" }, { status: 409 });
      }
      console.error("WiV1 atomic create RPC unavailable", createError);
      return NextResponse.json({ success: false, data: null, error: "Layanan pembuatan kartu belum tersedia" }, { status: 503 });
    }

    return NextResponse.json({ success: true, data: card, error: null }, { status: 201 });
  } catch (error) {
    console.error("WiV1 admin card create", error);
    const invalidInput = error instanceof z.ZodError || error instanceof SyntaxError;
    return NextResponse.json({
      success: false, data: null,
      error: invalidInput ? "Data kartu tidak valid" : "Layanan pembuatan kartu belum tersedia",
    }, { status: invalidInput ? 400 : 503 });
  }
}
