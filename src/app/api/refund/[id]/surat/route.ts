import { adminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { buildRefundLetter, type LetterConfig } from "@/lib/refund-letter";
import type { CertConfig } from "@/lib/certificate";

// Surat refund dijana atas permintaan (pemilik atau admin). Tiada surat untuk permohonan yang gagal semakan automatik (belum di-override).
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const p = await getProfile(); if (!p) return new Response(null, { status: 401 });
  const db = adminClient();
  const { data: r } = await db.from("refund_requests").select("id, status, reason, created_at, enrollment_id").eq("id", id).maybeSingle();
  if (!r) return new Response(null, { status: 404 });
  const { data: e } = await db.from("enrollments").select("user_id, course_id, order_id").eq("id", r.enrollment_id).single();
  if (p.role !== "admin" && e?.user_id !== p.id) return new Response(null, { status: 404 });
  if (r.status === "auto_failed") return new Response(null, { status: 403 });
  const [{ data: o }, { data: course }, { data: prof }, { data: au }] = await Promise.all([
    db.from("orders").select("order_number, paid_at, amount, currency").eq("id", e!.order_id).single(),
    db.from("courses").select("title, config").eq("id", e!.course_id).single(),
    db.from("profiles").select("full_name").eq("id", e!.user_id).single(),
    db.auth.admin.getUserById(e!.user_id),
  ]);
  const cfg = course?.config as Record<string, unknown>;
  const pdf = await buildRefundLetter({ requestId: r.id, holderName: prof!.full_name, email: au.user?.email ?? "", orderNumber: o!.order_number, paidAt: o!.paid_at!,
    amountSen: o!.amount, currency: o!.currency, courseTitle: course!.title, requestedAt: r.created_at, reason: r.reason },
    (cfg.refund_letter ?? {}) as LetterConfig, (cfg.certificate ?? {}) as CertConfig);
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="surat-refund-${r.id.slice(0, 8)}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
