"use server";
import { redirect } from "next/navigation";
import { quizContext, rpc, QUIZ_ERR } from "@/lib/quiz";
import type { FormState } from "../daftar/actions";

export async function mula(): Promise<FormState> {
  const { enrollment } = await quizContext();
  // Hanya ujian akhir: 40 soalan dipilih daripada bank setiap percubaan.
  const { data, error } = await rpc().rpc("start_quiz", { p_enrollment: enrollment.id, p_type: "final", p_chapter: null });
  if (error) return { error: QUIZ_ERR[error.message] ?? "Tidak dapat memulakan kuiz. Cuba lagi." };
  redirect(`/kuiz/${data}`);
}

export async function hantar(form: FormData) {
  const { enrollment } = await quizContext();
  const attempt = String(form.get("attempt") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(attempt)) redirect("/dashboard");
  // Borang hanya bawa pilihan; markah/kunci TIDAK pernah ada di sini. Pilihan tak sah dikira salah oleh DB.
  const answers: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("q_") && typeof v === "string") answers[k.slice(2)] = v;
  const { error } = await rpc().rpc("submit_quiz", { p_attempt: attempt, p_enrollment: enrollment.id, p_answers: answers });
  if (error && error.message !== "already_submitted") console.error("submit_quiz gagal", error.message);
  redirect(`/kuiz/${attempt}`);
}
