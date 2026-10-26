import "server-only";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { getCourse } from "@/lib/course";
import { enrollmentFor } from "@/lib/learning";
import { requireRole } from "@/lib/auth";

/** Pelajar + enrollment AKTIF untuk kursus (satu kursus). Selain itu: ke dashboard. Fungsi DB menyemak akses sekali lagi. */
export async function quizContext() {
  await requireRole(["student"]);
  const course = await getCourse();
  if (!course) redirect("/");
  const { enrollment, active } = await enrollmentFor(course.id);
  if (!enrollment || !active) redirect("/dashboard");
  return { course, enrollment };
}

export const rpc = adminClient;

export const QUIZ_ERR: Record<string, string> = {
  gate_closed: "MCQ akhir dibuka selepas setiap video dicapai.",
  attempts_exhausted: "Had percubaan MCQ akhir telah habis. Hubungi admin.",
  already_passed: "Anda sudah lulus MCQ akhir.",
  no_questions: "Soalan latihan untuk bab ini belum tersedia.",
  bank_too_small: "Bank soalan belum mencukupi. Hubungi admin.",
  access_closed: "Akses telah tamat.",
  config_mcq_tiada: "Tetapan MCQ belum lengkap. Hubungi admin.",
};
