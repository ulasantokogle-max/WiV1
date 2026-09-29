import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { eventSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = eventSchema.parse(await request.json());
    const forwarded = request.headers.get("x-forwarded-for");
    const userAgent = request.headers.get("user-agent");

    const { data: card, error: cardError } = await supabaseAdmin
      .from("wifi_cards")
      .select("id,status")
      .eq("id", body.cardId)
      .maybeSingle();
    if (cardError) throw cardError;
    if (!card || card.status !== "active") {
      return NextResponse.json({ success: false, data: null, error: "Card tidak aktif" }, { status: 404 });
    }

    const { error } = await supabaseAdmin.from("wifi_events").insert({
      card_id: body.cardId,
      event_type: body.eventType,
      source: body.source,
      user_agent: userAgent,
      ip_hash: forwarded ? await sha256(forwarded.split(",")[0].trim()) : null,
    });

    if (error) throw error;
    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    console.error("WiV1 event error", error);
    return NextResponse.json({ success: false, data: null, error: "Invalid event" }, { status: 400 });
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
