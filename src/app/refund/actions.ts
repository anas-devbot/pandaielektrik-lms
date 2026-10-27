"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getCourse } from "@/lib/course";
import { enrollmentFor } from "@/lib/learning";
import { adminClient } from "@/lib/supabase/admin";
import { PART2_ERR, dropStored, maxSchematicMb, storeSchematic } from "@/lib/part2";

export type RefundState = { error?: string; ok?: string } | undefined;

async function ctx() {
  await requireRole(["student"]);
  const course = await getCourse(); if (!course) return null;
  const { enrollment } = await enrollmentFor(course.id);
  return enrollment ? { course, enrollment } : null;
}

export async function mohonRefund(_: RefundState, form: FormData): Promise<RefundState> {
  const c = await ctx(); if (!c) return { error: "Anda belum berenrollment." };
  if (form.get("confirm") !== "on") return { error: "Sila sahkan bahawa anda faham." };
  const { data, error } = await adminClient().rpc("request_refund", { p_enrollment: c.enrollment.id, p_reason: String(form.get("reason") ?? "") });
  if (error) return { error: PART2_ERR[error.message] ?? "Permohonan gagal." };
  revalidatePath("/refund"); revalidatePath("/dashboard");
  return { ok: data.status === "letter_issued" ? "Permohonan diterima. Muat turun surat refund di bawah." : "Permohonan direkod tetapi tidak lulus semakan automatik. Hubungi admin." };
}

export async function muatNaikSurat(_: RefundState, form: FormData): Promise<RefundState> {
  const c = await ctx(); if (!c) return { error: "Anda belum berenrollment." };
  const request = String(form.get("request") ?? ""), file = form.get("surat");
  if (!/^[0-9a-f-]{36}$/i.test(request)) return { error: "Permohonan tidak sah." };
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih foto atau imbasan surat bertandatangan." };
  const max = await maxSchematicMb(c.course.id); if (!max) return { error: "Tetapan saiz fail belum lengkap. Hubungi admin." };
  const stored = await storeSchematic(c.enrollment.id, file, max, "surat", "refunds");
  if ("error" in stored) return { error: stored.error };
  const { error } = await adminClient().rpc("attach_signed_letter", { p_request: request, p_enrollment: c.enrollment.id, p_file_key: stored.key });
  if (error) { await dropStored(stored.key); return { error: PART2_ERR[error.message] ?? "Muat naik gagal." }; }
  revalidatePath("/refund");
  return { ok: "Surat dimuat naik. Menunggu semakan admin." };
}
