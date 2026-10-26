import { adminClient } from "@/lib/supabase/admin";
import { enrollmentFor } from "@/lib/learning";
import { signedGetUrl } from "@/lib/r2";

// PDF: semak log masuk + enrollment AKTIF -> log akses (untuk semakan refund) -> redirect ke signed URL jangka pendek.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const db = adminClient();
  const { data: m } = await db.from("materials").select("id, course_id, title, r2_key").eq("id", id).maybeSingle();
  if (!m) return new Response(null, { status: 404 });
  const { user, enrollment, active } = await enrollmentFor(m.course_id);
  if (!user) return new Response(null, { status: 401 });
  if (!enrollment || !active) return new Response(null, { status: 403 });

  await db.from("material_access_log").insert({ enrollment_id: enrollment.id, material_id: m.id });
  try {
    const url = await signedGetUrl(m.r2_key, `${m.title}.pdf`);
    return new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store" } });
  } catch (e) {
    console.error("signedGetUrl gagal", e instanceof Error ? e.message : e);
    return new Response(null, { status: 500 });
  }
}
