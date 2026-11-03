"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, homeFor } from "@/lib/auth";
import { periksaKataLaluan } from "@/lib/password";

export type UbahState = { error?: string } | undefined;

// Hanya berjaya bila sesi pemulihan (dari pautan emel) wujud. Sesi lain ditamatkan selepas tukar.
export async function kemaskiniKataLaluan(_: UbahState, form: FormData): Promise<UbahState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi tamat. Minta pautan baharu." };
  const pw = String(form.get("password") ?? "");
  const sahkan = String(form.get("password_sahkan") ?? "");
  if (pw !== sahkan) return { error: "Kata laluan tidak sepadan." };
  const salah = periksaKataLaluan(pw, user.email ?? "");
  if (salah) return { error: salah };
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: "Gagal tetapkan kata laluan. Minta pautan baharu." };
  await supabase.auth.signOut({ scope: "others" });
  const p = await getProfile();
  redirect(p ? homeFor(p.role) : "/log-masuk");
}
