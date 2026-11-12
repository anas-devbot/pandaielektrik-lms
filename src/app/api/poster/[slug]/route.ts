import { createClient as createPublicClient } from "@supabase/supabase-js";
import { readObject } from "@/lib/storage";

// Poster kursus (katalog). Hanya untuk kursus yang dipaparkan (RLS awam). Bucket R2 kekal privat: server baca dan hidang bait.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return new Response(null, { status: 404 });
  const db = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: course } = await db.from("courses").select("poster_key").eq("slug", slug).eq("published", true).maybeSingle();
  if (!course?.poster_key) return new Response(null, { status: 404 });
  try {
    const bytes = await readObject(course.poster_key);
    return new Response(new Uint8Array(bytes), { headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "x-content-type-options": "nosniff",
    } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
