"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

export type OpState = { error?: string; ok?: string } | undefined;

const RALAT: Record<string, string> = {
  bad_transition: "Tukar status ini tidak dibenarkan dari keadaan semasa.",
  note_required: "Nota wajib diisi untuk tindakan ini.",
  ref_required: "Rujukan transfer bank wajib diisi.",
  bad_status: "Payout ini tidak lagi berstatus menunggu bayaran.",
  payout_non_positive: "Jumlah payout tidak positif, tidak boleh dibayar.",
  not_found: "Rekod tidak dijumpai.",
  config_affiliate_tiada: "Kadar affiliate belum ditetapkan dalam config kursus.",
  actor_not_admin: "Hanya admin boleh melakukan tindakan ini.",
};
const mesej = (e: { message: string }) => RALAT[e.message] ?? "Tindakan gagal. Cuba lagi.";

// Luluskan / tolak / gantung affiliate. Peraturan transisi dan nota wajib ada dalam fungsi SQL.
export async function tukarStatus(_: OpState, form: FormData): Promise<OpState> {
  const me = await requireRole(["admin"]);
  const { error } = await adminClient().rpc("affiliate_set_status", {
    p_actor: me.id,
    p_affiliate: String(form.get("affiliate") ?? ""),
    p_to: String(form.get("to") ?? ""),
    p_note: String(form.get("note") ?? ""),
  });
  if (error) return { error: mesej(error) };
  revalidatePath("/admin/affiliate");
  revalidatePath("/affiliate/dashboard");
  return { ok: "Status dikemas kini." };
}

// Tandakan payout 'due' sudah dibayar. Rujukan transfer disimpan; nombor akaun TIDAK dilibatkan.
export async function tandaiBayar(_: OpState, form: FormData): Promise<OpState> {
  const me = await requireRole(["admin"]);
  const { data, error } = await adminClient().rpc("affiliate_mark_payout_paid", {
    p_actor: me.id,
    p_payout: String(form.get("payout") ?? ""),
    p_ref: String(form.get("ref") ?? ""),
  });
  if (error) return { error: mesej(error) };
  revalidatePath("/admin/affiliate");
  revalidatePath("/affiliate/dashboard");
  return { ok: `Ditandakan dibayar. ${data ?? 0} komisen ditukar kepada dibayar.` };
}
