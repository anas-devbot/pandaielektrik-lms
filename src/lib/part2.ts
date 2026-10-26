import "server-only";
import { randomBytes } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { normalizeSchematic } from "@/lib/image";
import { putObject, deleteObject } from "@/lib/storage";

export const PART2_ERR: Record<string, string> = {
  part2_closed: "Bahagian 2 dibuka selepas MCQ akhir lulus.",
  not_resubmittable: "Item ini sedang disemak atau sudah lulus.",
  access_closed: "Akses telah tamat.",
  bad_text: "Jawapan subjektif tidak boleh kosong.",
  claimed_by_other: "Item ini sedang disemak oleh penilai lain.",
  nothing_pending: "Tiada item menunggu semakan.",
  not_claimed_by_you: "Anda perlu menuntut item ini dahulu (atau tuntutan telah luput).",
  comment_required: "Komen wajib bila menolak.",
  already_reviewed: "Item ini sudah disemak.",
  reason_required: "Sebab wajib diisi.",
  received_at_required: "Tarikh terima wajib.",
  received_at_future: "Tarikh terima tidak boleh pada masa depan.",
  reviewer_required: "Penilai (reviewer/approver/admin) wajib dan mesti sah.",
  actor_not_admin: "Hanya admin.",
  no_enrollment: "Enrollment tidak dijumpai.",
  bad_count: "Bilangan mesti 1 atau lebih.",
};

/** Fail skematik: semak saiz (config), sahkan jenis, tukar HEIC->JPG, buang metadata, simpan di storan peribadi. */
export async function storeSchematic(enrollmentId: string, file: File, maxMb: number): Promise<{ key: string } | { error: string }> {
  const maxBytes = Math.floor(maxMb * 1024 * 1024);
  if (file.size > maxBytes) return { error: `Fail terlalu besar (maksimum ${maxMb} MB).` };
  const r = await normalizeSchematic(Buffer.from(await file.arrayBuffer()), maxBytes);
  if (!r.ok) return { error: r.error === "bad_type" ? "Jenis fail tidak disokong. Guna JPG, PNG atau HEIC." : r.error === "too_large" ? `Fail terlalu besar (maksimum ${maxMb} MB).` : "Imej tidak dapat dibaca." };
  const key = `submissions/${enrollmentId}/schematic-${Date.now()}-${randomBytes(4).toString("hex")}.jpg`;
  await putObject(key, r.jpeg, "image/jpeg");
  return { key };
}
export const dropStored = (key: string) => deleteObject(key).catch(() => {});

export async function maxSchematicMb(courseId: string): Promise<number | null> {
  const { data } = await adminClient().from("courses").select("config").eq("id", courseId).single();
  const v = Number((data?.config as Record<string, unknown> | null)?.schematic_max_mb);
  return Number.isFinite(v) && v > 0 ? v : null;   // wajib dalam config (CLAUDE.md #12)
}
