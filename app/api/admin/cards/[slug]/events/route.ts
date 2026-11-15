import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWiV1Provider } from "@/lib/wiv1-access";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await requireWiV1Provider())) return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    const { slug } = await params;
    const { data: card, error: cardError } = await supabaseAdmin.from("wifi_cards").select("id").eq("slug", slug).maybeSingle();
    if (cardError) throw cardError;
    if (!card) return NextResponse.json({ success: false, data: null, error: "Card tidak ditemukan" }, { status: 404 });
    const { data: events, error } = await supabaseAdmin.from("wifi_events").select("id,event_type,source,created_at,user_agent").eq("card_id", card.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ success: true, data: { events: events ?? [] }, error: null });
  } catch (error) {
    console.error("WiV1 admin card events", error);
    return NextResponse.json({ success: false, data: null, error: "Gagal memuat aktivitas" }, { status: 500 });
  }
}
