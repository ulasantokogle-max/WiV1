import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { wifiCardLandingUrl } from "@/lib/wifi-card-link";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    // Keep inactive/suspended card QR from being distributed as a working link.
    const { data: card, error } = await supabaseAdmin
      .from("wifi_cards")
      .select("id")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) {
      console.error("WiV1 card QR lookup failed", error);
      return NextResponse.json({ error: "QR unavailable" }, { status: 503, headers });
    }
    if (!card) return NextResponse.json({ error: "Card unavailable" }, { status: 404, headers });

    const url = wifiCardLandingUrl(slug, request.url, process.env.VERCEL_ENV, process.env.WIV1_BASE_URL);
    const png = await QRCode.toBuffer(url, { type: "png", width: 900, margin: 2 });
    return new NextResponse(Uint8Array.from(png), {
      headers: { ...headers, "Content-Type": "image/png" },
    });
  } catch (error) {
    console.error("WiV1 card QR generation failed", error);
    return NextResponse.json({ error: "QR unavailable" }, { status: 503, headers });
  }
}
