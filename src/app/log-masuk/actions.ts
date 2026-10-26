"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NEXT_PREFIXES, getProfile, homeFor, safeNext } from "@/lib/auth";
import type { FormState } from "../daftar/actions";

export async function logMasuk(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Mesej sama untuk emel salah dan kata laluan salah (elak enumerasi akaun).
  if (error) return { email, error: "Emel atau kata laluan salah." };
  const p = await getProfile();
  if (!p) return { error: "Akaun tiada profil. Hubungi admin." };
  const next = safeNext(form.get("next"));
  // `next` hanya dihormati jika dalam kawasan yang dibenarkan untuk peranan itu; jika tidak, ke rumah peranan.
  const allowed = next && NEXT_PREFIXES[p.role].some((pre) => next === pre || next.startsWith(pre + "/") || next.startsWith(pre + "?"));
  redirect(allowed ? next : homeFor(p.role));
}

export async function logKeluar() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/log-masuk");
}
