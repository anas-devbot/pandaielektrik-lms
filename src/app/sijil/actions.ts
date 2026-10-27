"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getCourse } from "@/lib/course";
import { enrollmentFor } from "@/lib/learning";
import { adminClient } from "@/lib/supabase/admin";

export type SijilState = { error?: string; ok?: string } | undefined;
const ERR: Record<string, string> = {
  not_eligible: "Anda belum layak mengeluarkan sijil ini.", identity_required: "Pengesahan identiti oleh AHZ diperlukan dahulu. Hubungi AHZ.",
  bad_name: "Nama tidak sah. Guna huruf sahaja (2 hingga 120 aksara).", refunded: "Pendaftaran ini telah dipulangkan.",
  track_locked: "Trek telah dipilih dan tidak boleh ditukar.", practical_not_ready: "Sijil trek praktikal belum dibuka.",
};

// Trek teori sahaja. Nama pada sijil disahkan pelajar (tidak boleh diubah selepas dikeluarkan; admin boleh batal dan keluarkan semula).
export async function terbitSijil(_: SijilState, form: FormData): Promise<SijilState> {
  await requireRole(["student"]);
  const course = await getCourse();
  if (!course) return { error: "Kursus tidak dijumpai." };
  const { enrollment } = await enrollmentFor(course.id);   // akses tamat tidak menghalang: sijil kekal selepas akses tamat
  if (!enrollment) return { error: "Anda belum berenrollment." };
  if (form.get("confirm") !== "on") return { error: "Sila sahkan ejaan nama anda." };
  const db = adminClient();
  if (!enrollment.cert_track) {
    const { error } = await db.rpc("choose_track", { p_enrollment: enrollment.id, p_track: "theory" });
    if (error) return { error: ERR[error.message] ?? "Tidak dapat memilih trek." };
  }
  const { error } = await db.rpc("issue_certificate", { p_enrollment: enrollment.id, p_type: "theory", p_holder_name: String(form.get("name") ?? "") });
  if (error) return { error: ERR[error.message] ?? "Sijil tidak dapat dikeluarkan." };
  revalidatePath("/dashboard");
  return { ok: "Sijil dikeluarkan." };
}
