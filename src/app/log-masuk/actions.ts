"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { NEXT_PREFIXES, getProfile, homeFor, safeNext } from "@/lib/auth";
import { kunciEmel, masaKunci, selepasGagal, type Rekod } from "@/lib/login-throttle";
import type { FormState } from "../daftar/actions";

export async function logMasuk(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  // Had per emel (lihat src/lib/login-throttle.ts). ponytail: baca dan tulis tak atomik, cukup untuk had pada percubaan berulang satu akaun.
  const db = adminClient();
  const key = kunciEmel(email);
  const { data: rekodRaw } = await db.from("login_attempts").select("failures, window_start, locked_until").eq("email_key", key).maybeSingle();
  const rekod = rekodRaw as Rekod | null;
  const tamat = masaKunci(rekod);
  if (tamat) return { email, error: `Terlalu banyak percubaan. Cuba semula dalam ${Math.ceil((tamat - Date.now()) / 60_000)} minit.` };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Mesej sama untuk emel salah dan kata laluan salah (elak enumerasi akaun).
  if (error) {
    await db.from("login_attempts").upsert({ email_key: key, ...selepasGagal(rekod) });
    return { email, error: "Emel atau kata laluan salah." };
  }
  await db.from("login_attempts").delete().eq("email_key", key);
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
