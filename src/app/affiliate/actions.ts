"use server";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { getCourse } from "@/lib/course";
import { parseRefParam } from "@/lib/affiliate";
import { adminClient } from "@/lib/supabase/admin";

export type AffiliateState = { error?: string; ok?: string } | undefined;

// Permohonan affiliate: status 'pending' sehingga AHZ luluskan (B8). Kadar disalin dari config semasa mohon.
export async function mohonAffiliate(_: AffiliateState, form: FormData): Promise<AffiliateState> {
  const p = await getProfile();
  if (!p) return { error: "Sila log masuk dahulu." };
  if (p.role !== "student") return { error: "Akaun ini tidak boleh mendaftar sebagai affiliate." };
  if (form.get("terms") !== "on") return { error: "Sila setuju dengan draf terma affiliate." };
  const code = parseRefParam(String(form.get("code") ?? "").trim());
  if (!code) return { error: "Kod mesti 4 hingga 20 huruf atau nombor, tanpa simbol atau ruang." };

  const course = await getCourse();
  const rate = Number((course?.config as Record<string, unknown> | undefined)?.affiliate_rate_pct);
  if (!course || !Number.isFinite(rate)) return { error: "Program affiliate belum tersedia." };

  const db = adminClient();
  const { data: existing } = await db.from("affiliates").select("id").eq("user_id", p.id).maybeSingle();
  if (existing) return { error: "Anda sudah mendaftar sebagai affiliate." };

  const { error } = await db.from("affiliates").insert({ user_id: p.id, code, status: "pending", rate_pct: rate });
  if (error) return { error: error.code === "23505" ? "Kod ini sudah digunakan. Pilih kod lain." : "Permohonan gagal. Cuba lagi." };
  revalidatePath("/affiliate");
  revalidatePath("/affiliate/dashboard");
  return { ok: "Permohonan diterima. Menunggu semakan AHZ." };
}
