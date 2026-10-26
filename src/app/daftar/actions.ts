"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRIVACY_VERSION } from "@/content/privacy";

export type FormState = { error?: string; email?: string; fullName?: string } | undefined;

export async function daftar(_: FormState, form: FormData): Promise<FormState> {
  const fullName = String(form.get("full_name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const keep = { email, fullName };
  if (fullName.length < 2 || fullName.length > 120) return { ...keep, error: "Sila isi nama penuh." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ...keep, error: "Emel tidak sah." };
  if (password.length < 8) return { ...keep, error: "Kata laluan minimum 8 aksara." };
  if (form.get("privacy") !== "on") return { ...keep, error: "Anda mesti bersetuju dengan notis privasi untuk mendaftar." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, privacy_accepted: true, privacy_version: PRIVACY_VERSION } },
  });
  if (error) return { ...keep, error: "Pendaftaran gagal. Semak maklumat anda dan cuba lagi." };
  redirect(data.session ? "/dashboard" : "/daftar/semak-emel");
}
