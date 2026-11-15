import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWiV1Provider } from "@/lib/wiv1-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

const schema = z.object({
  businessId: z.string().uuid(),
  email: z.string().trim().email().max(320),
});

export async function POST(request: Request) {
  try {
    if (!(await requireWiV1Provider())) {
      return NextResponse.json({ success: false, error: "Provider access required" }, { status: 403 });
    }
    const input = schema.parse(await request.json());
    const { data, error } = await supabaseAdmin.rpc("wiv1_assign_business_owner", {
      p_business_id: input.businessId,
      p_email: input.email,
    });
    if (error) {
      console.error("WiV1 owner assignment failed", error);
      return NextResponse.json({ success: false, error: "Gagal menghubungkan owner" }, { status: 503 });
    }
    if (!data?.assigned) {
      return NextResponse.json({ success: false,
        error: data?.reason === "provider_account" ? "Gunakan akun client, bukan akun provider" :
          data?.reason === "already_owned" ? "Bisnis sudah memiliki owner. Perubahan kepemilikan memerlukan persetujuan owner." :
          "Akun client belum ditemukan atau email belum diverifikasi",
      }, { status: 422 });
    }
    return NextResponse.json({ success: true, data: { assigned: true } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: "Data tidak valid" }, { status: 400 });
    }
    console.error("WiV1 owner assignment unavailable", error);
    return NextResponse.json({ success: false, error: "Layanan tidak tersedia" }, { status: 503 });
  }
}
