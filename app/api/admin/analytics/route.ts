import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";

async function requireAdmin() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabaseAdmin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  return !!data;
}

export async function GET() {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ success:false, data:null, error:"Unauthorized" }, {status:401});
    const { data: cards, error: cardError } = await supabaseAdmin.from("wifi_cards").select("id,card_code,slug,businesses(name)").order("created_at", {ascending:false});
    if (cardError) throw cardError;
    const ids = (cards ?? []).map(c => c.id);
    const { data: events, error:eventError } = ids.length ? await supabaseAdmin.from("wifi_events").select("card_id,event_type").in("card_id", ids) : {data:[],error:null};
    if (eventError) throw eventError;
    const rows = (cards ?? []).map(card => {
      const own = (events ?? []).filter(e => e.card_id === card.id);
      const count = (type:string) => own.filter(e => e.event_type === type).length;
const businessRelation = card.businesses as
  | { name: string }[]
  | { name: string }
  | null;

const business = Array.isArray(businessRelation)
  ? businessRelation[0]?.name
  : businessRelation?.name;
      return { card_id:card.id, card_code:card.card_code, slug:card.slug, business:business ?? "-", views:count("page_view"), qr:count("qr_scan"), nfc:count("nfc_scan"), copies:count("password_copy"), connects:count("wifi_connect") };
    });
    return NextResponse.json({success:true,data:{rows},error:null});
  } catch (error) {
    console.error("WiV1 analytics", error);
    return NextResponse.json({success:false,data:null,error:"Gagal memuat analytics"},{status:500});
  }
}
