import { adminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { viewObject } from "@/lib/storage";

// Surat bertandatangan yang dimuat naik: pemilik atau admin sahaja.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const p = await getProfile(); if (!p) return new Response(null, { status: 401 });
  const db = adminClient();
  const { data: r } = await db.from("refund_requests").select("signed_letter_key, enrollment_id").eq("id", id).maybeSingle();
  if (!r?.signed_letter_key) return new Response(null, { status: 404 });
  const { data: e } = await db.from("enrollments").select("user_id").eq("id", r.enrollment_id).single();
  if (p.role !== "admin" && e?.user_id !== p.id) return new Response(null, { status: 404 });
  try {
    const v = await viewObject(r.signed_letter_key);
    const h = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
    if ("redirect" in v) return new Response(null, { status: 302, headers: { ...h, location: v.redirect } });
    return new Response(new Uint8Array(v.bytes), { headers: { ...h, "content-type": "image/jpeg" } });
  } catch { return new Response(null, { status: 404 }); }
}
