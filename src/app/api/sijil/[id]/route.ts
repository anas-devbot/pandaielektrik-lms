import { adminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { buildCertificatePdf, type CertConfig } from "@/lib/certificate";

// PDF dijana atas permintaan daripada data snapshot dalam DB. Pemilik (atau admin) sahaja; sijil dibatalkan tidak boleh dimuat turun.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const p = await getProfile();
  if (!p) return new Response(null, { status: 401 });
  const db = adminClient();
  const { data: c } = await db.from("certificates").select("id, type, cert_id, verify_token, holder_name, course_title, period_start, period_end, revoked_at, course_id, enrollment_id").eq("id", id).maybeSingle();
  if (!c) return new Response(null, { status: 404 });
  if (p.role !== "admin") {
    const { data: e } = await db.from("enrollments").select("user_id").eq("id", c.enrollment_id).single();
    if (e?.user_id !== p.id) return new Response(null, { status: 404 });   // tidak dedahkan kewujudan
  }
  if (c.revoked_at) return new Response(null, { status: 410 });
  const { data: course } = await db.from("courses").select("config").eq("id", c.course_id).single();
  const cfg = ((course?.config as Record<string, unknown> | null)?.certificate ?? {}) as CertConfig;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
  const pdf = await buildCertificatePdf({
    certId: c.cert_id, type: c.type, holderName: c.holder_name!, courseTitle: c.course_title!, periodStart: c.period_start!, periodEnd: c.period_end!,
    verifyUrl: `${site}/semak/${c.verify_token}`, revoked: false,
  }, cfg);
  return new Response(new Uint8Array(pdf), { headers: {
    "content-type": "application/pdf", "content-disposition": `attachment; filename="${c.cert_id}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
