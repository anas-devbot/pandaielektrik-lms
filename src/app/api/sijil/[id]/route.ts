import { adminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { type CertConfig } from "@/lib/certificate";
import { CERT_COLUMNS, bunaPdfSijil, simpanPdfSijil, type CertRow } from "@/lib/sijil-pdf";
import { downloadObject } from "@/lib/storage";

// PDF sijil yang dah disimpan di R2 (pdf_key) dihidang melalui signed URL jangka pendek.
// Sijil belum disimpan (cth. wording belum diluluskan, atau simpanan gagal semasa terbit) dijana atas permintaan.
// Pemilik (atau admin) sahaja; sijil dibatalkan tidak boleh dimuat turun.
export const dynamic = "force-dynamic";

const pdfResponse = (bytes: Uint8Array, certId: string) => new Response(new Uint8Array(bytes), { headers: {
  "content-type": "application/pdf", "content-disposition": `attachment; filename="${certId}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const p = await getProfile();
  if (!p) return new Response(null, { status: 401 });
  const db = adminClient();
  const { data } = await db.from("certificates").select(CERT_COLUMNS).eq("id", id).maybeSingle();
  const c = data as (CertRow & { enrollment_id: string; revoked_at: string | null }) | null;
  if (!c) return new Response(null, { status: 404 });
  if (p.role !== "admin") {
    const { data: e } = await db.from("enrollments").select("user_id").eq("id", c.enrollment_id).single();
    if (e?.user_id !== p.id) return new Response(null, { status: 404 });   // tidak dedahkan kewujudan
  }
  if (c.revoked_at) return new Response(null, { status: 410 });

  // belum disimpan (sijil diterbit sebelum wording diluluskan, atau bukan melalui terbitSijil): simpan sekali bila wording dah lulus
  let key = c.pdf_key;
  if (!key) {
    try { await simpanPdfSijil(c.id); } catch (e) { console.error("simpan PDF sijil gagal", c.id, e); }
    const { data: row } = await db.from("certificates").select("pdf_key").eq("id", c.id).single();
    key = (row as { pdf_key: string | null } | null)?.pdf_key ?? null;
  }
  if (key) {
    const r = await downloadObject(key, `${c.cert_id}.pdf`);
    if ("redirect" in r) return new Response(null, { status: 302, headers: { location: r.redirect, "cache-control": "private, no-store" } });
    return pdfResponse(r.bytes, c.cert_id);
  }
  // belum disimpan: jana atas permintaan daripada snapshot DB dan config semasa
  const { data: course } = await db.from("courses").select("config").eq("id", c.course_id).single();
  const cfg = ((course?.config as Record<string, unknown> | null)?.certificate ?? {}) as CertConfig;
  return pdfResponse(await bunaPdfSijil(c, cfg), c.cert_id);
}
