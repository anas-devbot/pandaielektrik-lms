"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRIVACY_VERSION } from "@/content/privacy";
import { periksaKataLaluan } from "@/lib/password";

export type FormState = { error?: string; email?: string; fullName?: string } | undefined;

export async function daftar(_: FormState, form: FormData): Promise<FormState> {
  const fullName = String(form.get("full_name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const keep = { email, fullName };
  if (fullName.length < 2 || fullName.length > 120) return { ...keep, error: "Sila isi nama penuh." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ...keep, error: "Emel tidak sah." };
  const salahKata = periksaKataLaluan(password, email);
  if (salahKata) return { ...keep, error: salahKata };
  if (form.get("privacy") !== "on") return { ...keep, error: "Anda mesti bersetuju dengan notis privasi untuk mendaftar." };

  const supabase = await createClient();
  // Pautan pengesahan emel melalui /auth/callback (tukar kod kepada sesi), bukan terus ke laman utama.
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      emailRedirectTo: `${base}/auth/callback?next=/dashboard`,
      data: { full_name: fullName, privacy_accepted: true, privacy_version: PRIVACY_VERSION },
    },
  });
  if (error) return { ...keep, error: "Pendaftaran gagal. Semak maklumat anda dan cuba lagi." };
  redirect(data.session ? "/dashboard" : "/daftar/semak-emel");
}
