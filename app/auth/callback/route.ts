import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// The callback intentionally accepts no arbitrary redirect URL.
// Never send authentication codes or tokens to a different origin.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL("/auth/verified", request.nextUrl.origin);

  if (!code) {
    destination.searchParams.set("status", "invalid");
    return NextResponse.redirect(destination, { status: 303 });
  }

  try {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    destination.searchParams.set("status", error ? "invalid" : "success");
  } catch {
    destination.searchParams.set("status", "unavailable");
  }
  const response = NextResponse.redirect(destination, { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
