"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { CONFIG_FIELDS } from "@/lib/config-fields";
import { PART2_ERR } from "@/lib/part2";

export type OpState = { error?: string; ok?: string } | undefined;
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v) ? v : null;
const ERR: Record<string, string> = { ...PART2_ERR, bad_days: "Hari mesti 1 hingga 365.", key_not_allowed: "Kunci ini tidak boleh diubah.", bad_value: "Nilai tidak sah.", out_of_range: "Nilai di luar julat.",
  bad_status: "Status tidak sah.", bad_dates: "Tarikh tamat mesti selepas tarikh mula.", bad_capacity: "Kapasiti tidak sah.", starts_required: "Tarikh mula wajib.", not_found: "Tidak dijumpai.",
  already_enrolled: "Pelajar sudah berenrollment.", reason_required: "Sebab wajib diisi.", bad_phone: "Nombor telefon mesti bermula 01 dengan 10 atau 11 digit." };

// SATU pintu masuk untuk tindakan admin dalam modul. Pelaku = sesi (admin). DB menyemak peranan, memadam ralat, dan merekod admin_actions.
export async function jalankan(_: OpState, f: FormData): Promise<OpState> {
  const me = await requireRole(["admin"]);
  const db = adminClient(); const op = s(f, "op"); const reason = s(f, "reason");
  let error: { message: string } | null = null; let okMsg = "Direkod dalam admin_actions."; let path = "/admin";

  if (op === "extend_access") {
    const e = uuid(s(f, "enrollment")); if (!e) return { error: "Pendaftaran tidak sah." }; path = `/admin/pelajar/${e}`;
    const { data, error: er } = await db.rpc("extend_access", { p_actor: me.id, p_enrollment: e, p_days: Number(s(f, "days")), p_reason: reason }); error = er;
    if (!er) okMsg = `Akses kini sehingga ${new Intl.DateTimeFormat("ms-MY", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(data as string))}. Direkod.`;
  } else if (op === "extra_attempts") {
    const e = uuid(s(f, "enrollment")); if (!e) return { error: "Pendaftaran tidak sah." }; path = `/admin/pelajar/${e}`;
    ({ error } = await db.rpc("grant_extra_attempts", { p_actor: me.id, p_enrollment: e, p_count: Number(s(f, "count")), p_reason: reason }));
  } else if (op === "verify_identity") {
    const e = uuid(s(f, "enrollment")); if (!e) return { error: "Pendaftaran tidak sah." }; path = `/admin/pelajar/${e}`;
    ({ error } = await db.rpc("verify_identity", { p_actor: me.id, p_enrollment: e, p_method: s(f, "method"), p_reason: reason }));
  } else if (op === "telegram_link") {
    const e = uuid(s(f, "enrollment")); if (!e) return { error: "Pendaftaran tidak sah." }; path = `/admin/pelajar/${e}`;
    ({ error } = await db.rpc("set_telegram_link", { p_actor: me.id, p_enrollment: e, p_link: s(f, "link") }));
  } else if (op === "edit_phone") {
    const e = uuid(s(f, "enrollment")); const u = uuid(s(f, "user"));
    if (!e || !u) return { error: "Pelajar tidak sah." }; path = `/admin/pelajar/${e}`;
    ({ error } = await db.rpc("admin_set_phone", { p_actor: me.id, p_user: u, p_phone: s(f, "phone").replace(/[\s-]/g, ""), p_reason: reason }));
    if (!error) okMsg = "Nombor telefon dikemas kini. Direkod dalam admin_actions (tanpa nombor).";
  } else if (op === "revoke_cert") {
    const c = uuid(s(f, "certificate")); if (!c) return { error: "Sijil tidak sah." }; path = `/admin/pelajar/${s(f, "back")}`;
    ({ error } = await db.rpc("revoke_certificate", { p_actor: me.id, p_certificate: c, p_reason: reason }));
  } else if (op === "grant_manual") {
    path = "/admin/pelajar";
    const { data: uid } = await db.rpc("find_user_by_email", { p_email: s(f, "email") }); if (!uid) return { error: "Pelajar tidak dijumpai." };
    const { data: course } = await db.from("courses").select("id").order("created_at").limit(1).single();
    ({ error } = await db.rpc("grant_manual", { p_user: uid as string, p_course: course!.id, p_actor: me.id, p_reason: reason }));
  } else if (op === "config") {
    path = "/admin/kursus";
    const field = CONFIG_FIELDS.find((x) => x.key === s(f, "key")); if (!field) return { error: "Kunci tidak sah." };
    const raw = s(f, "value"); let value: unknown;
    if (field.kind === "bool") value = raw === "true";
    else if (field.kind === "text") value = raw;
    else { if (raw === "" || Number.isNaN(Number(raw))) return { error: "Masukkan nombor." }; value = Number(raw); }
    const { data: course } = await db.from("courses").select("id").order("created_at").limit(1).single();
    ({ error } = await db.rpc("update_course_config", { p_actor: me.id, p_course: course!.id, p_path: field.key.split("."), p_value: value, p_reason: reason }));
  } else if (op === "session") {
    path = "/admin/kursus";
    const { data: course } = await db.from("courses").select("id").order("created_at").limit(1).single();
    const id = s(f, "id"); const my = (v: string) => (v ? `${v}:00+08:00` : null);   // masukan dianggap waktu Malaysia (UTC+8)
    const cap = s(f, "capacity");
    ({ error } = await db.rpc("upsert_session", { p_actor: me.id, p_id: id ? uuid(id) : null, p_course: course!.id, p_starts: my(s(f, "starts_at")), p_ends: my(s(f, "ends_at")),
      p_venue: s(f, "venue"), p_capacity: cap === "" ? null : Number(cap), p_status: s(f, "status") }));
  } else return { error: "Tindakan tidak sah." };

  if (error) return { error: ERR[error.message] ?? `Gagal (${error.message}).` };
  if (op === "config" || op === "session") revalidateTag("landing");   // landing baca kursus + sesi (cache)
  revalidatePath(path); revalidatePath("/admin");
  return { ok: okMsg };
}
