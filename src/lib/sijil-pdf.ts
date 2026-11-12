import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { buildCertificatePdf, type CertConfig } from "@/lib/certificate";
import { putObject } from "@/lib/storage";

// Sijil disimpan SEKALI di R2 semasa diterbitkan (certificates.pdf_key), supaya dokumen yang dimuat turun
// tidak berubah bila tajuk, penandatangan atau susun atur ditukar kemudian. Hanya selepas wording diluluskan AHZ:
// PDF DRAF tidak disimpan. Gagal simpan tidak membatalkan sijil; route jana semula sebagai fallback.

export const CERT_COLUMNS = "id, type, cert_id, verify_token, holder_name, course_title, period_start, period_end, revoked_at, course_id, enrollment_id, pdf_key";

export type CertRow = {
  id: string; cert_id: string; type: "theory" | "theory_practical"; verify_token: string;
  holder_name: string | null; course_title: string | null; period_start: string | null; period_end: string | null; course_id: string; pdf_key: string | null;
};

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";

export async function bunaPdfSijil(c: CertRow, cfg: CertConfig): Promise<Uint8Array> {
  return buildCertificatePdf({
    certId: c.cert_id, type: c.type, holderName: c.holder_name!, courseTitle: c.course_title!, periodStart: c.period_start!, periodEnd: c.period_end!,
    verifyUrl: `${siteUrl()}/semak/${c.verify_token}`, revoked: false,
  }, cfg);
}

/** Simpan PDF sijil sekali. Mengembalikan 'stored', 'already', atau 'skipped_draf'. */
export async function simpanPdfSijil(certRowId: string): Promise<"stored" | "already" | "skipped_draf"> {
  const db = adminClient();
  const { data } = await db.from("certificates").select(CERT_COLUMNS).eq("id", certRowId).single();
  const c = data as CertRow | null;
  if (!c) throw new Error("sijil tidak dijumpai");
  if (c.pdf_key) return "already";
  const { data: course } = await db.from("courses").select("config").eq("id", c.course_id).single();
  const cfg = ((course?.config as Record<string, unknown> | null)?.certificate ?? {}) as CertConfig;
  if (!cfg.wording_approved) return "skipped_draf";
  const pdf = await bunaPdfSijil(c, cfg);
  const key = `sijil/${c.cert_id}.pdf`;
  await putObject(key, Buffer.from(pdf), "application/pdf");
  // hanya tulis kunci jika belum ada (elak tindih jika dua permintaan serentak)
  const { error } = await db.from("certificates").update({ pdf_key: key }).eq("id", c.id).is("pdf_key", null);
  if (error) throw new Error(`kemas kini pdf_key gagal: ${error.message}`);
  return "stored";
}
