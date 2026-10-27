"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getCourse } from "@/lib/course";
import { enrollmentFor } from "@/lib/learning";
import { adminClient } from "@/lib/supabase/admin";
import { PART2_ERR, dropStored, maxSchematicMb, storeSchematic } from "@/lib/part2";

export type PraktikalState = { error?: string; ok?: string } | undefined;

async function ctx() {
  await requireRole(["student"]);
  const course = await getCourse();
  if (!course) return null;
  const { enrollment, active } = await enrollmentFor(course.id);
  return enrollment ? { course, enrollment, active } : null;
}

// Pilih trek praktikal: terkunci (polisi tukar trek belum diputuskan AHZ), jadi pelajar mesti mengesahkan.
export async function pilihTrekPraktikal(_: PraktikalState, form: FormData): Promise<PraktikalState> {
  const c = await ctx();
  if (!c) return { error: "Anda belum berenrollment." };
  if (form.get("confirm") !== "on") return { error: "Sila sahkan bahawa anda faham trek tidak boleh ditukar." };
  const { error } = await adminClient().rpc("choose_track", { p_enrollment: c.enrollment.id, p_track: "theory_practical" });
  if (error) return { error: PART2_ERR[error.message] ?? "Tidak dapat memilih trek." };
  revalidatePath("/dashboard"); revalidatePath("/praktikal");
  return { ok: "Trek praktikal dipilih." };
}

export async function hantarBorang(_: PraktikalState, form: FormData): Promise<PraktikalState> {
  const c = await ctx();
  if (!c) return { error: "Anda belum berenrollment." };
  const file = form.get("form");
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih fail borang bertandatangan (foto atau imbasan)." };
  const max = await maxSchematicMb(c.course.id);
  if (!max) return { error: "Tetapan saiz fail belum lengkap. Hubungi admin." };
  const stored = await storeSchematic(c.enrollment.id, file, max, "form");
  if ("error" in stored) return { error: stored.error };
  const { error } = await adminClient().rpc("submit_practical", { p_enrollment: c.enrollment.id, p_type: "form", p_file_key: stored.key, p_external_ref: null, p_consent: null });
  if (error) { await dropStored(stored.key); return { error: PART2_ERR[error.message] ?? "Penghantaran borang gagal." }; }
  revalidatePath("/praktikal");
  return { ok: "Borang dihantar. Menunggu semakan." };
}

// "Isytihar video dihantar": video sebenar ada di Telegram group. LMS hanya merekod deklarasi, rujukan dan persetujuan privasi.
export async function isytiharVideo(_: PraktikalState, form: FormData): Promise<PraktikalState> {
  const c = await ctx();
  if (!c) return { error: "Anda belum berenrollment." };
  const { error } = await adminClient().rpc("submit_practical", {
    p_enrollment: c.enrollment.id, p_type: "video", p_file_key: null,
    p_external_ref: String(form.get("ref") ?? ""), p_consent: form.get("consent") === "on",
  });
  if (error) return { error: PART2_ERR[error.message] ?? "Deklarasi gagal." };
  revalidatePath("/praktikal");
  return { ok: "Deklarasi direkod. Menunggu semakan. Jangan masukkan bekalan." };
}
