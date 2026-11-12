"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

// Modul Staf (hanya admin). Semua semakan peranan dibuat dalam fungsi DB; di sini hanya orkestrasi akaun auth.
// Kata laluan sementara dijana di sini, dipulangkan SEKALI kepada admin yang meminta, dan TIDAK disimpan, dilog atau dimasukkan ke admin_actions.
export type StafState = { error?: string; ok?: string; tempPassword?: string; email?: string; v?: { email: string; name: string; role: string } } | undefined;
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const uuid = (v: string) => (/^[0-9a-f-]{36}$/i.test(v) ? v : null);
const ROLES = ["reviewer", "approver", "admin"];
const ERR: Record<string, string> = {
  actor_not_admin: "Hanya admin boleh melakukan tindakan ini.", bad_role: "Peranan tidak sah.", bad_email: "Emel tidak sah.",
  user_exists_staff: "Emel ini sudah menjadi staf.", self_change: "Anda tidak boleh mengubah akaun sendiri.", reason_required: "Sebab wajib diisi.",
  student_needs_confirm: "Pengguna ini pelajar. Tandakan pengesahan untuk menjadikannya staf.", no_change: "Peranan sama; tiada perubahan.",
  not_found: "Pengguna tidak dijumpai.", not_staff: "Pengguna ini bukan staf.", last_admin: "Admin terakhir tidak boleh dibuang atau diturunkan.",
};
const msg = (m?: string) => ERR[m ?? ""] ?? "Tindakan gagal. Cuba lagi.";

export async function tambahStaf(_: StafState, f: FormData): Promise<StafState> {
  const me = await requireRole(["admin"]);
  const email = s(f, "email").toLowerCase(), name = s(f, "name"), role = s(f, "role");
  const confirmStudent = f.get("confirm_student") === "on";
  const bad = (error: string): StafState => ({ error, v: { email, name, role } }); // nilai dikekalkan supaya borang tidak dikosongkan selepas ralat
  if (!name || name.length > 100) return bad("Nama wajib (maksimum 100 aksara).");
  if (!ROLES.includes(role)) return bad(ERR.bad_role);
  const db = adminClient();

  const inv = await db.rpc("add_staff", { p_actor: me.id, p_email: email, p_role: role });
  if (inv.error) {
    if (inv.error.message === "user_exists_student") {
      if (!confirmStudent) return bad("Emel ini sudah berdaftar sebagai pelajar. Tandakan pengesahan jika memang mahu menjadikannya staf (kata laluan mereka tidak diubah).");
      // ponytail: senarai pengguna dibaca sekali; cukup untuk beberapa ratus akaun. Gunakan carian emel jika pengguna melebihi 1000.
      const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
      const u = list?.users.find((x) => x.email?.toLowerCase() === email);
      if (!u) return bad(ERR.not_found);
      const r = await db.rpc("set_staff_role", { p_actor: me.id, p_target: u.id, p_role: role, p_confirm_student: true, p_reason: "Pelajar dilantik menjadi staf (disahkan admin)" });
      if (r.error) return bad(msg(r.error.message));
      revalidatePath("/admin/staf");
      return { ok: `${email} kini ${role}. Kata laluan sedia ada mereka tidak diubah.` };
    }
    return bad(msg(inv.error.message));
  }

  const password = randomBytes(12).toString("base64url");
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (created.error || !created.data.user) {
    await db.from("staff_invites").delete().eq("email", email); // jemputan tidak boleh tertinggal tanpa akaun
    return bad("Akaun gagal dicipta. Cuba lagi.");
  }
  const rec = await db.rpc("confirm_staff_added", { p_actor: me.id, p_user: created.data.user.id, p_role: role });
  revalidatePath("/admin/staf");
  if (rec.error) return { error: "Akaun dicipta tetapi rekod gagal. Hubungi pembangun.", email };
  return { ok: `Akaun ${email} dicipta sebagai ${role}.`, tempPassword: password, email };
}

export async function ubahPeranan(_: StafState, f: FormData): Promise<StafState> {
  const me = await requireRole(["admin"]);
  const target = uuid(s(f, "target")); const role = s(f, "role");
  if (!target) return { error: ERR.not_found };
  const { error } = await adminClient().rpc("set_staff_role", { p_actor: me.id, p_target: target, p_role: role, p_confirm_student: false, p_reason: s(f, "reason") });
  if (error) return { error: msg(error.message) };
  revalidatePath("/admin/staf");
  return { ok: "Peranan dikemas kini. Direkod dalam admin_actions." };
}

export async function nyahaktifStaf(_: StafState, f: FormData): Promise<StafState> {
  const me = await requireRole(["admin"]);
  const target = uuid(s(f, "target"));
  if (!target) return { error: ERR.not_found };
  if (f.get("confirm") !== "on") return { error: "Tandakan pengesahan untuk menyahaktifkan." };
  const db = adminClient();
  const { error } = await db.rpc("deactivate_staff", { p_actor: me.id, p_target: target, p_reason: s(f, "reason") });
  if (error) return { error: msg(error.message) };
  // Sekat log masuk (akaun TIDAK dipadam: rekod kelulusan/penilaian merujuk pelaku).
  const ban = await db.auth.admin.updateUserById(target, { ban_duration: "876000h" });
  revalidatePath("/admin/staf");
  if (ban.error) return { error: "Peranan dibuang, tetapi sekatan log masuk gagal. Hubungi pembangun." };
  return { ok: "Staf dinyahaktifkan: peranan dibuang dan log masuk disekat. Rekod kekal. Direkod dalam admin_actions." };
}
