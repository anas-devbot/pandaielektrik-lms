"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { PART2_ERR } from "@/lib/part2";

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
const note = (f: FormData) => String(f.get("note") ?? "");
export type RefundAdminState = { error?: string; ok?: string } | undefined;

// Semua keputusan: pelaku daripada sesi (admin sahaja); DB menyemak peranan, status dan nota, dan merekod dalam admin_actions.
export async function tindakanRefund(_: RefundAdminState, f: FormData): Promise<RefundAdminState> {
  const me = await requireRole(["admin"]);
  const id = uuid(f.get("request")); const op = String(f.get("op") ?? "");
  if (!id) return { error: "Permohonan tidak sah." };
  const db = adminClient();
  let error: { message: string } | null = null;
  if (op === "override") ({ error } = await db.rpc("admin_override_refund", { p_actor: me.id, p_request: id, p_note: note(f) }));
  else if (op === "approve" || op === "reject") ({ error } = await db.rpc("decide_refund", { p_actor: me.id, p_request: id, p_decision: op === "approve" ? "approved" : "rejected", p_note: note(f) }));
  else if (op === "refunded") ({ error } = await db.rpc("mark_refunded", { p_actor: me.id, p_request: id, p_note: note(f) }));
  else return { error: "Tindakan tidak sah." };
  if (error) return { error: PART2_ERR[error.message] ?? `Gagal (${error.message}).` };
  revalidatePath("/admin/refund");
  return { ok: "Direkod dalam admin_actions." };
}
