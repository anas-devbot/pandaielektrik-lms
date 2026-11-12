"use server";
import { revalidateTag } from "next/cache";
import sharp from "sharp";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { putObject } from "@/lib/storage";

// Katalog kursus (migration 20261113000005). Admin sahaja. Setiap perubahan direkod dalam admin_actions oleh RPC.
// Poster: had 2 MB, dikecilkan kepada 720×900 untuk telefon, disimpan di R2 privat (poster/<id>.jpg).

export type KatalogState = { error?: string; ok?: string } | undefined;

const MAX_POSTER_BYTES = 2 * 1024 * 1024;
const ERR: Record<string, string> = {
  bad_title: "Tajuk mesti 3 hingga 120 aksara.",
  bad_slug: "Slug hanya huruf kecil, nombor, dan sempang (3 hingga 60 aksara).",
  bad_summary: "Ringkasan terlalu panjang (maksimum 400 aksara).",
  bad_price: "Harga tidak sah.",
  bad_cta: "Jenis CTA tidak sah.",
  bad_cta_url: "Pautan WhatsApp mesti bermula dengan https://chat.whatsapp.com/ atau https://wa.me/.",
  bad_published: "Status paparan tidak sah.",
  actor_not_admin: "Akses ditolak.",
  not_found: "Kursus tidak dijumpai.",
};

export async function simpanKatalog(_: KatalogState, f: FormData): Promise<KatalogState> {
  const me = await requireRole(["admin"]);
  const db = adminClient();

  const idRaw = String(f.get("id") ?? "").trim();
  const id = /^[0-9a-f-]{36}$/i.test(idRaw) ? idRaw : null;
  const title = String(f.get("title") ?? "").trim();
  const slug = String(f.get("slug") ?? "").trim().toLowerCase();
  const summary = String(f.get("summary") ?? "").trim();
  const priceRm = Number(String(f.get("price") ?? "").replace(",", "."));
  const price = Number.isFinite(priceRm) ? Math.round(priceRm * 100) : -1;
  const cta = String(f.get("cta") ?? "whatsapp");
  const ctaUrl = String(f.get("cta_url") ?? "").trim();
  const published = f.get("published") === "on";
  const file = f.get("poster");

  // Semak dan kecilkan poster dahulu, sebelum apa-apa ditulis ke DB
  let posterBytes: Buffer | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_POSTER_BYTES) return { error: "Poster melebihi 2 MB. Kecilkan fail dan cuba semula." };
    const raw = Buffer.from(await file.arrayBuffer());
    try {
      const meta = await sharp(raw).metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format ?? "")) return { error: "Format poster mesti JPG, PNG, atau WebP." };
      posterBytes = await sharp(raw).rotate().resize(720, 900, { fit: "cover" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    } catch {
      return { error: "Fail poster tidak boleh dibaca. Cuba fail lain." };
    }
  }

  const args = { p_actor: me.id, p_title: title, p_slug: slug, p_summary: summary || null, p_price: price, p_cta: cta, p_cta_url: ctaUrl, p_published: published };
  const { data: cid, error } = await db.rpc("upsert_course_catalog", { ...args, p_id: id, p_poster_key: null });
  if (error) {
    if (/duplicate key|courses_slug_key/i.test(error.message)) return { error: "Slug sudah digunakan oleh kursus lain." };
    return { error: ERR[error.message] ?? "Kursus tidak dapat disimpan." };
  }
  const courseId = cid as string;

  if (posterBytes) {
    const key = `poster/${courseId}.jpg`;
    try {
      await putObject(key, posterBytes, "image/jpeg");
    } catch {
      return { error: "Kursus disimpan, tetapi poster gagal dimuat naik. Cuba muat naik semula." };
    }
    const { error: e2 } = await db.rpc("upsert_course_catalog", { ...args, p_id: courseId, p_poster_key: key });
    if (e2) return { error: "Poster dimuat naik tetapi belum dikaitkan dengan kursus. Cuba simpan semula." };
  }

  revalidateTag("landing");
  return { ok: "Kursus disimpan." };
}
