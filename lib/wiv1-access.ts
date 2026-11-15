import { createSupabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function currentWiV1User() {
  const client = await createSupabaseServer();
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : user;
}

export async function requireWiV1Provider() {
  const user = await currentWiV1User();
  if (!user) return null;
  const { data, error } = await supabaseAdmin.from("admin_users")
    .select("role").eq("user_id", user.id).maybeSingle();
  if (error || data?.role !== "admin") return null;
  return user;
}

export async function requireWiV1Client() {
  const user = await currentWiV1User();
  if (!user) return null;
  const { data: provider } = await supabaseAdmin.from("admin_users")
    .select("role").eq("user_id", user.id).maybeSingle();
  return provider?.role === "admin" ? null : user;
}

export async function ownedWiV1BusinessIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from("wiv1_business_owners")
    .select("business_id").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map(row => row.business_id);
}

export async function isWiV1BusinessOwned(businessId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin.from("wiv1_business_owners")
    .select("business_id", { head: true, count: "exact" }).eq("business_id", businessId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
