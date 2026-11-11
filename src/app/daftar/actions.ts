"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRIVACY_VERSION } from "@/content/privacy";
import { periksaKataLaluan } from "@/lib/password";
import { normalNamaPenuh, periksaNamaPenuh } from "@/lib/nama";
import { JANTINA, JULAT_UMUR, NEGERI, nilaiPilihan, normalTelefon, periksaDaerah, periksaPilihan, periksaTelefon } from "@/lib/profil";

export type FormState = {
  error?: string; email?: string; fullName?: string;
  phone?: string; gender?: string; ageRange?: string; state?: string; district?: string;
} | undefined;

export async function daftar(_: FormState, form: FormData): Promise<FormState> {
  const fullName = normalNamaPenuh(String(form.get("full_name") ?? ""));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  // Maklumat pilihan: kosong dibenarkan (null).
  const phone = normalTelefon(nilaiPilihan(form.get("phone")));
  const gender = nilaiPilihan(form.get("gender"));
  const ageRange = nilaiPilihan(form.get("age_range"));
  const state = nilaiPilihan(form.get("state"));
  const district = nilaiPilihan(form.get("district"));
  const keep = { email, fullName, phone: phone ?? "", gender: gender ?? "", ageRange: ageRange ?? "", state: state ?? "", district: district ?? "" };
  const namaSalah = periksaNamaPenuh(fullName);
  if (namaSalah) return { ...keep, error: namaSalah };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ...keep, error: "Emel tidak sah." };
  const salahKata = periksaKataLaluan(password, email);
  if (salahKata) return { ...keep, error: salahKata };
  const salahPilihan =
    periksaTelefon(phone) ??
    periksaPilihan(gender, JANTINA.map((j) => j.nilai), "Pilihan jantina tidak sah.") ??
    periksaPilihan(ageRange, JULAT_UMUR.map((j) => j.nilai), "Pilihan julat umur tidak sah.") ??
    periksaPilihan(state, NEGERI, "Pilihan negeri tidak sah.") ??
    periksaDaerah(district);
  if (salahPilihan) return { ...keep, error: salahPilihan };
  if (form.get("privacy") !== "on") return { ...keep, error: "Anda mesti bersetuju dengan notis privasi untuk mendaftar." };

  const supabase = await createClient();
  // Pautan pengesahan emel melalui /auth/callback (tukar kod kepada sesi), bukan terus ke laman utama.
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      emailRedirectTo: `${base}/auth/callback?next=/dashboard`,
      data: {
        full_name: fullName, privacy_accepted: true, privacy_version: PRIVACY_VERSION,
        phone, gender, age_range: ageRange, state, district,
      },
    },
  });
  if (error) return { ...keep, error: "Pendaftaran gagal. Semak maklumat anda dan cuba lagi." };
  redirect(data.session ? "/dashboard" : "/daftar/semak-emel");
}
