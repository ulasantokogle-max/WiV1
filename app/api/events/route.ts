import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { ZodError } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { eventSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    // No cookies or personally identifying IP values are written to the database.
    const body = eventSchema.parse(await request.json());
    const rawIp = request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const key = process.env.WIV1_ENCRYPTION_KEY;
    if (!key) throw new Error("Missing server-side event hash key");
    const ipHash = createHmac("sha256", key).update(rawIp).digest("hex");

    // Server-side transactional throttle, shared across serverless instances.
    // Migration 002 must be installed before this endpoint goes live.
    const { data: accepted, error } = await supabaseAdmin.rpc("wiv1_record_event_limited", {
      p_card_id: body.cardId,
      p_event_type: body.eventType,
      p_source: body.source,
      p_ip_hash: ipHash,
      p_user_agent: request.headers.get("user-agent") || "",
    });
    if (error) {
      console.error("WiV1 event RPC unavailable", error);
      return NextResponse.json({ success: false, data: null, error: "Event service unavailable" }, { status: 503 });
    }
    if (!accepted) {
      return NextResponse.json({ success: false, data: null, error: "Card inactive or event limit reached" }, { status: 429 });
    }
    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    console.error("WiV1 event rejected", error);
    const invalidInput = error instanceof ZodError || error instanceof SyntaxError;
    return NextResponse.json({ success: false, data: null, error: invalidInput ? "Invalid event" : "Event service unavailable" }, { status: invalidInput ? 400 : 503 });
  }
}
