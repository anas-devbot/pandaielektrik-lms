"use server";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { PART2_ERR } from "@/lib/part2";

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
const STAFF = ["reviewer", "approver", "admin"] as const;

export async function tuntut(form: FormData) {
  const me = await requireRole([...STAFF]);
  const enrollment = uuid(form.get("enrollment"));
  if (!enrollment) redirect("/staff");
  const { error } = await adminClient().rpc("claim_review", { p_enrollment: enrollment, p_reviewer: me.id });
  redirect(`/staff/semak/${enrollment}${error ? `?ralat=${encodeURIComponent(PART2_ERR[error.message] ?? "Tuntutan gagal.")}` : ""}`);
}

export async function semak(form: FormData) {
  const me = await requireRole([...STAFF]);
  const sub = uuid(form.get("submission")), enrollment = uuid(form.get("enrollment"));
  const decision = String(form.get("decision") ?? "");
  if (!sub || !enrollment) redirect("/staff");
  // Penilai diambil daripada sesi, BUKAN daripada borang. DB menyemak tuntutan dan peranan sekali lagi.
  const { error } = await adminClient().rpc("review_submission", {
    p_submission: sub, p_reviewer: me.id, p_decision: decision, p_comment: String(form.get("comment") ?? ""),
  });
  redirect(`/staff/semak/${enrollment}${error ? `?ralat=${encodeURIComponent(PART2_ERR[error.message] ?? "Semakan gagal.")}` : ""}`);
}
