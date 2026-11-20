"use server";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { encryptAkaun, last4, normalAkaun } from "@/lib/affiliate-bank";
import { BANK_LIST } from "@/lib/bank-list";
import { adminClient } from "@/lib/supabase/admin";

export type BankState = { error?: string; ok?: string } | undefined;

// Simpan/tukar butiran bank affiliate sendiri. Nombor akaun dienkrip sebelum masuk DB. Nilai TIDAK dilog.
export async function simpanBank(_: BankState, form: FormData): Promise<BankState> {
  const p = await getProfile();
  if (!p) return { error: "Sila log masuk dahulu." };
  if (p.role !== "student") return { error: "Akaun ini tidak mempunyai akaun affiliate." };

  const bank = String(form.get("bank_name") ?? "");
  if (!(BANK_LIST as readonly string[]).includes(bank)) return { error: "Pilih bank dari senarai." };
  const nama = String(form.get("account_name") ?? "").trim().replace(/\s+/g, " ");
  if (nama.length < 3 || nama.length > 120) return { error: "Nama pemegang akaun seperti dalam akaun bank (3 hingga 120 aksara)." };
  const akaun = normalAkaun(String(form.get("account_no") ?? ""));
  if (!akaun) return { error: "Nombor akaun mesti 6 hingga 20 digit." };

  const keyB64 = process.env.AFFILIATE_BANK_KEY;
  if (!keyB64) return { error: "Penyimpanan bank belum dikonfigurasi. Hubungi admin." };
  let enc: string;
  try { enc = encryptAkaun(akaun, keyB64); } catch { return { error: "Penyimpanan bank belum dikonfigurasi. Hubungi admin." }; }

  const db = adminClient();
  const { data: aff } = await db.from("affiliates").select("id, status").eq("user_id", p.id).maybeSingle();
  if (!aff || aff.status === "rejected") return { error: "Anda belum mempunyai akaun affiliate aktif." };

  const { error } = await db.from("affiliates").update({
    bank_name: bank, bank_account_name: nama, bank_account_enc: enc,
    bank_account_last4: last4(akaun), bank_updated_at: new Date().toISOString(),
  }).eq("id", aff.id);
  if (error) return { error: "Simpan gagal. Cuba lagi." };

  const { error: logErr } = await db.from("admin_actions").insert({
    actor_id: p.id, action: "affiliate_bank_changed", reason: "Kemas kini butiran bank affiliate", detail: { affiliate_id: aff.id },
  });
  if (logErr) console.error("log bank affiliate gagal", logErr.message);

  revalidatePath("/affiliate/dashboard");
  revalidatePath("/admin/affiliate");
  return { ok: "Butiran bank disimpan. Bayaran seterusnya akan masuk ke akaun ini." };
}
