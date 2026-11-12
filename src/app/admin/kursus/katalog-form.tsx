"use client";
import { useActionState } from "react";
import { simpanKatalog } from "./katalog-actions";
import { Button } from "@/components/button";

export type KatalogCourse = {
  id: string; slug: string; title: string; summary: string | null; price: number;
  cta: "daftar" | "whatsapp"; cta_url: string; published: boolean; poster_key: string | null;
};

const WA_DEFAULT = "https://chat.whatsapp.com/FZlPLzJrC5a9IK5nLAqroz";
const SLUG_DAFTAR = "kursus-elektrik";
const input = "rounded-md border border-border bg-surface p-3 text-base";

// Borang katalog: kursus sedia ada (kemas kini) atau kursus baharu (course tidak diberi).
export function KatalogForm({ course }: { course?: KatalogCourse }) {
  const [state, action, pending] = useActionState(simpanKatalog, undefined);
  const isDiy = course?.slug === SLUG_DAFTAR;
  return (
    <form action={action} className="mt-3 grid gap-3">
      {course && <input type="hidden" name="id" value={course.id} />}

      <label className="grid gap-1 text-sm">Tajuk kursus
        <input name="title" required minLength={3} maxLength={120} defaultValue={course?.title ?? ""} className={input} />
      </label>

      <label className="grid gap-1 text-sm">Slug (alamat kursus, huruf kecil dan sempang)
        <input name="slug" required pattern="[a-z0-9-]{3,60}" defaultValue={course?.slug ?? ""} className={input} />
        <span className="text-xs text-muted">Contoh: pendawaian-3-fasa. Tukar slug akan tukar alamat poster kursus.</span>
      </label>

      <label className="grid gap-1 text-sm">Ringkasan (maksimum 400 aksara)
        <textarea name="summary" rows={3} maxLength={400} defaultValue={course?.summary ?? ""} className={input} />
      </label>

      <label className="grid gap-1 text-sm">Harga (RM)
        <input name="price" inputMode="decimal" required defaultValue={course ? (course.price / 100).toFixed(2) : ""} className={input} />
      </label>

      <label className="grid gap-1 text-sm">CTA utama
        <select name="cta" defaultValue={course?.cta ?? "whatsapp"} className={input}>
          {isDiy && <option value="daftar">Daftar dan bayar</option>}
          <option value="whatsapp">Sertai group WhatsApp sahaja</option>
        </select>
        <span className="text-xs text-muted">Daftar dan bayar hanya untuk kursus DIY buat masa ini.</span>
      </label>

      <label className="grid gap-1 text-sm">Pautan WhatsApp (dipaparkan untuk semua kursus)
        <input name="cta_url" type="url" required defaultValue={course?.cta_url ?? WA_DEFAULT} className={input} />
      </label>

      <label className="grid gap-1 text-sm">Poster
        <input name="poster" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
        <span className="rounded-md border border-border bg-surface p-3 text-xs text-muted">
          Ingat: fail maksimum <b>2 MB</b>. Format JPG, PNG, atau WebP. Disyorkan <b>1080 × 1350 px</b> (nisbah 4:5).
          Sistem kecilkan automatik kepada 720 × 900 untuk telefon.
        </span>
        {course?.poster_key && course.published && (
          <img src={`/api/poster/${course.slug}`} alt="" width={120} height={150} className="mt-2 aspect-[4/5] w-24 rounded-md object-cover" />
        )}
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input name="published" type="checkbox" defaultChecked={course?.published ?? false} className="size-5" />
        Paparkan di landing
      </label>

      {state?.error && <p role="alert" className="text-sm text-error">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-success">{state.ok}</p>}
      <Button type="submit" loading={pending}>{course ? "Simpan kursus" : "Tambah kursus"}</Button>
    </form>
  );
}
