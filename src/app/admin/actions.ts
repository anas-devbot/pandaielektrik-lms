"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { PART2_ERR, dropStored, maxSchematicMb, storeSchematic } from "@/lib/part2";

export type AdminState = { error?: string; ok?: string } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function userId(email: string) {
  const { data } = await adminClient().rpc("find_user_by_email", { p_email: email });
  return (data as string | null) ?? null;
}
async function enrollmentOf(uid: string) {
  const db = adminClient();
  const { data: course } = await db.from("courses").select("id").order("created_at").limit(1).single();
  const { data: e } = await db.from("enrollments").select("id").eq("user_id", uid).eq("course_id", course!.id).maybeSingle();
  return e?.id as string | undefined;
}

// Tindakan admin: pelaku diambil daripada SESI (bukan borang); DB menyemak peranan admin semula dan merekod dalam admin_actions.
export async function tambahPercubaan(_: AdminState, f: FormData): Promise<AdminState> {
  const me = await requireRole(["admin"]);
  const count = Number(str(f, "count"));
  const uid = await userId(str(f, "email"));
  if (!uid) return { error: "Pelajar tidak dijumpai." };
  const eid = await enrollmentOf(uid);
  if (!eid) return { error: "Pelajar belum berenrollment." };
  const { data, error } = await adminClient().rpc("grant_extra_attempts", { p_actor: me.id, p_enrollment: eid, p_count: Number.isInteger(count) ? count : 0, p_reason: str(f, "reason") });
  if (error) return { error: PART2_ERR[error.message] ?? "Tindakan gagal." };
  revalidatePath("/admin");
  return { ok: `Percubaan tambahan kini ${data} untuk pelajar ini. Direkod dalam admin_actions.` };
}

export async function rekodManual(_: AdminState, f: FormData): Promise<AdminState> {
  const me = await requireRole(["admin"]);
  const uid = await userId(str(f, "email"));
  if (!uid) return { error: "Pelajar tidak dijumpai." };
  const eid = await enrollmentOf(uid);
  if (!eid) return { error: "Pelajar belum berenrollment." };
  const reviewer = await userId(str(f, "reviewer_email"));
  const type = str(f, "type");
  const file = f.get("file");
  let key: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (type !== "schematic") return { error: "Fail hanya untuk skematik." };
    const db = adminClient();
    const { data: e } = await db.from("enrollments").select("course_id").eq("id", eid).single();
    const max = await maxSchematicMb(e!.course_id);
    if (!max) return { error: "Tetapan saiz fail belum lengkap." };
    const stored = await storeSchematic(eid, file, max);
    if ("error" in stored) return { error: stored.error };
    key = stored.key;
  }
  const { error } = await adminClient().rpc("record_manual_submission", {
    p_actor: me.id, p_enrollment: eid, p_type: type, p_received_at: str(f, "received_at") || null, p_reviewer: reviewer,
    p_decision: str(f, "decision"), p_comment: str(f, "comment"), p_text: str(f, "text") || null, p_file_key: key, p_reason: str(f, "reason"),
  });
  if (error) { if (key) await dropStored(key); return { error: PART2_ERR[error.message] ?? `Rekod gagal (${error.message}).` }; }
  revalidatePath("/admin");
  return { ok: `Direkod (manual_fasi). ${key ? "Fail disimpan." : "Fail di luar sistem."} Direkod dalam admin_actions.` };
}
