"use server";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { PART2_ERR } from "@/lib/part2";

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
const back = (e: string, err?: string) => redirect(`/staff/praktikal/${e}${err ? `?ralat=${encodeURIComponent(err)}` : ""}`);

export async function tuntutPraktikal(form: FormData) {
  const me = await requireRole(["reviewer", "approver", "admin"]);
  const e = uuid(form.get("enrollment")); if (!e) redirect("/staff");
  const { error } = await adminClient().rpc("claim_practical", { p_enrollment: e, p_reviewer: me.id });
  back(e, error ? PART2_ERR[error.message] ?? "Tuntutan gagal." : undefined);
}

export async function semakPraktikal(form: FormData) {
  const me = await requireRole(["reviewer", "approver", "admin"]);
  const s = uuid(form.get("submission")), e = uuid(form.get("enrollment")); if (!s || !e) redirect("/staff");
  const { error } = await adminClient().rpc("review_practical_item", { p_submission: s, p_reviewer: me.id, p_decision: String(form.get("decision") ?? ""), p_comment: String(form.get("comment") ?? "") });
  back(e, error ? PART2_ERR[error.message] ?? "Semakan gagal." : undefined);
}

// KEBENARAN BEKALAN: tindakan manual approver. Pelaku daripada sesi; DB menyemak peranan 'approver', video semasa, borang dan teks panduan.
export async function luluskanBekalan(form: FormData) {
  const me = await requireRole(["approver"]);
  const e = uuid(form.get("enrollment")), v = uuid(form.get("video")); if (!e || !v) redirect("/staff");
  if (form.get("confirm") !== "on") back(e, "Sila sahkan bahawa anda telah menyemak borang dan video.");
  const { error } = await adminClient().rpc("approve_energize", { p_actor: me.id, p_enrollment: e, p_video: v });
  back(e, error ? PART2_ERR[error.message] ?? "Kelulusan gagal." : undefined);
}

export async function rekodKeputusan(form: FormData) {
  const me = await requireRole(["reviewer", "approver"]);
  const e = uuid(form.get("enrollment")); if (!e) redirect("/staff");
  const { error } = await adminClient().rpc("record_practical_result", { p_reviewer: me.id, p_enrollment: e, p_result: String(form.get("result") ?? ""), p_comment: String(form.get("comment") ?? "") });
  back(e, error ? PART2_ERR[error.message] ?? "Keputusan gagal direkod." : undefined);
}
