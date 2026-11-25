import { NextResponse } from "next/server";
import { requireWiV1Client, ownedWiV1BusinessIds } from "@/lib/wiv1-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const user = await requireWiV1Client();
    if (!user) return NextResponse.json({ success: false, error: "Client login required" }, { status: 401 });
    const businessIds = await ownedWiV1BusinessIds(user.id);
    if (!businessIds.length) return NextResponse.json({ success: true, data: { cards: [], businesses: [], analytics: {} } }, { headers: { "Cache-Control": "private, no-store" } });

    const [{ data: cards, error: cardsError }, { data: businesses, error: businessesError }] = await Promise.all([
      supabaseAdmin.from("wifi_cards")
        .select("id,business_id,card_code,slug,status,created_at,businesses(name),locations(name),wifi_networks(ssid,security_type,instructions)")
        .in("business_id", businessIds).order("created_at", { ascending: false }),
      supabaseAdmin.from("businesses").select("id,name,status").in("id", businessIds),
    ]);
    if (cardsError || businessesError) throw cardsError || businessesError;

    const ids = (cards ?? []).map(card => card.id);
    const { data: events, error: eventError } = ids.length ?
      await supabaseAdmin.from("wifi_events").select("card_id,event_type")
        .in("card_id", ids) : { data: [], error: null };
    if (eventError) throw eventError;
    const analytics = Object.fromEntries((cards ?? []).map(card => {
      const own = (events ?? []).filter(event => event.card_id === card.id);
      const count = (type: string) => own.filter(event => event.event_type === type).length;
      return [card.id, { views: count("page_view"), qr: count("qr_scan"),
        nfc: count("nfc_scan"), copies: count("password_copy"), connects: count("wifi_connect") }];
    }));
    return NextResponse.json({ success: true, data: { cards: cards ?? [], businesses: businesses ?? [], analytics } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("WiV1 client cards unavailable", error);
    return NextResponse.json({ success: false, error: "Gagal memuat data bisnis" }, { status: 503 });
  }
}
