"use server";
import { revalidatePath } from "next/cache";
import { quizContext } from "@/lib/quiz";
import { adminClient } from "@/lib/supabase/admin";
import { PART2_ERR, dropStored, maxSchematicMb, storeSchematic } from "@/lib/part2";

export type Part2State = { error?: string; ok?: string } | undefined;

export async function hantarBahagian2(_: Part2State, form: FormData): Promise<Part2State> {
  const { course, enrollment } = await quizContext();
  const text = String(form.get("subjective") ?? "").trim();
  const file = form.get("schematic");
  const hasFile = file instanceof File && file.size > 0;
  if (!text && !hasFile) return { error: "Isi jawapan subjektif atau pilih fail skematik." };
  const db = adminClient();
  const done: string[] = [];

  if (text) {
    const { error } = await db.rpc("submit_part2", { p_enrollment: enrollment.id, p_type: "subjective", p_text: text, p_file_key: null });
    if (error) return { error: PART2_ERR[error.message] ?? "Penghantaran subjektif gagal." };
    done.push("subjektif");
  }
  if (hasFile) {
    const max = await maxSchematicMb(course.id);
    if (!max) return { error: "Tetapan saiz fail belum lengkap. Hubungi admin.", ok: done.length ? `Dihantar: ${done.join(", ")}.` : undefined };
    const stored = await storeSchematic(enrollment.id, file, max);
    if ("error" in stored) return { error: stored.error, ok: done.length ? `Dihantar: ${done.join(", ")}.` : undefined };
    const { error } = await db.rpc("submit_part2", { p_enrollment: enrollment.id, p_type: "schematic", p_text: null, p_file_key: stored.key });
    if (error) { await dropStored(stored.key); return { error: PART2_ERR[error.message] ?? "Penghantaran skematik gagal.", ok: done.length ? `Dihantar: ${done.join(", ")}.` : undefined }; }
    done.push("skematik");
  }
  revalidatePath("/bahagian2");
  return { ok: `Dihantar: ${done.join(" dan ")}. Menunggu semakan.` };
}
