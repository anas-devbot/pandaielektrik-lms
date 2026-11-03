"use server";
import { createClient } from "@/lib/supabase/server";

export type ResetState = { sent?: boolean; error?: string } | undefined;

// Mesej sama untuk emel wujud atau tidak (elak enumerasi akaun). Hanya had kadar yang diberitahu.
export async function mintaPautan(_: ResetState, form: FormData): Promise<ResetState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Emel tidak sah." };
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/callback?next=/kemaskini-kata-laluan`,
  });
  if (error?.status === 429) return { error: "Terlalu banyak permintaan. Cuba sebentar lagi." };
  return { sent: true };
}
