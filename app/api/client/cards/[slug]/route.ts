import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { encryptSecret } from "@/lib/crypto";
import { requireWiV1Client, ownedWiV1BusinessIds } from "@/lib/wiv1-access";
import { isValidProtectedWifiPassword } from "@/lib/wifi-validation";

const schema = z.object({
  ssid: z.string().trim().min(1).max(100),
  password: z.string().max(200).default(""),
  securityType: z.enum(["Open", "WPA2", "WPA3"]),
  instructions: z.string().max(2000).default(""),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireWiV1Client();
    if (!user) return NextResponse.json({ success: false, error: "Client login required" }, { status: 401 });
    const { slug } = await params;
    const input = schema.parse(await request.json());
    const { data: card, error: cardError } = await supabaseAdmin.from("wifi_cards")
      .select("id,business_id,status").eq("slug", slug).maybeSingle();
    if (cardError) throw cardError;
    if (!card) return NextResponse.json({ success: false, error: "Kartu tidak ditemukan" }, { status: 404 });
    const businesses = await ownedWiV1BusinessIds(user.id);
    if (!businesses.includes(card.business_id)) {
      return NextResponse.json({ success: false, error: "Bukan kartu bisnis Anda" }, { status: 403 });
    }

    const { data: network, error: networkError } = await supabaseAdmin.from("wifi_networks")
      .select("security_type").eq("card_id", card.id).single();
    if (networkError) throw networkError;
    if (input.securityType !== "Open" && (input.password || network.security_type === "Open") &&
        !isValidProtectedWifiPassword(input.password)) {
      return NextResponse.json({ success: false, error: "Password WPA wajib 8–63 byte atau 64 digit hex" }, { status: 400 });
    }
    const changes: Record<string, string | null> = {
      ssid: input.ssid, security_type: input.securityType, instructions: input.instructions || null,
    };
    if (input.securityType === "Open") changes.encrypted_password = encryptSecret("");
    else if (input.password) changes.encrypted_password = encryptSecret(input.password);
    const { error: updateError } = await supabaseAdmin.from("wifi_networks")
      .update(changes).eq("card_id", card.id);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, data: { slug } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: "Data WiFi tidak valid" }, { status: 400 });
    }
    console.error("WiV1 client card settings unavailable", error);
    return NextResponse.json({ success: false, error: "Gagal menyimpan WiFi" }, { status: 503 });
  }
}
