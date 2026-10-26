import { adminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { viewObject } from "@/lib/storage";

// Fail skematik: hanya pemilik atau staf. Tidak pernah URL awam; R2 = redirect signed URL pendek, no-store.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const p = await getProfile();
  if (!p) return new Response(null, { status: 401 });
  const db = adminClient();
  const { data: s } = await db.from("submissions").select("file_key, type, enrollment_id").eq("id", id).maybeSingle();
  if (!s || s.type !== "schematic" || !s.file_key) return new Response(null, { status: 404 });
  if (p.role === "student") {
    const { data: e } = await db.from("enrollments").select("user_id").eq("id", s.enrollment_id).single();
    if (e?.user_id !== p.id) return new Response(null, { status: 404 });   // tidak dedahkan kewujudan
  }
  try {
    const v = await viewObject(s.file_key);
    const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
    if ("redirect" in v) return new Response(null, { status: 302, headers: { ...headers, location: v.redirect } });
    return new Response(new Uint8Array(v.bytes), { headers: { ...headers, "content-type": "image/jpeg" } });
  } catch (e) {
    console.error("viewObject gagal", e instanceof Error ? e.message : e);
    return new Response(null, { status: 404 });
  }
}
