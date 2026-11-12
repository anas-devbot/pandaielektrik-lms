import { unstable_cache } from "next/cache";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const rm = (sen: number) =>
  new Intl.NumberFormat("ms-MY", { style: "currency", currency: "MYR", minimumFractionDigits: sen % 100 ? 2 : 0 }).format(sen / 100);

// UI satu kursus (skema sedia multi-course). Harga SENTIASA dibaca daripada DB di server.
export async function getCourse() {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("id, slug, title, price, currency, config").order("created_at").limit(1).maybeSingle();
  return data;
}

// Data awam landing: SENARAI kursus dipaparkan (katalog, migration 20261113000005) + sesi akan datang setiap kursus.
// Tiada cookie, jadi boleh di-cache: anon key sahaja, RLS awam (hanya published). Dibatalkan bila admin ubah katalog/sesi (tag "landing").
// ponytail: TTL 60s sebagai jaring kalau tag terlepas. Penapis "akan datang" dikira semasa cache diisi.
export const getLanding = unstable_cache(
  async () => {
    const db = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data: courses } = await db.from("courses")
      .select("id, slug, title, price, currency, summary, cta, cta_url, poster_key")
      .eq("published", true).order("created_at");
    if (!courses?.length) return { courses: [] };
    const { data: sessions } = await db.from("course_sessions").select("id, course_id, starts_at, ends_at, venue_or_link, capacity, status")
      .in("course_id", courses.map((c) => c.id)).in("status", ["open", "full"]).gte("starts_at", new Date().toISOString()).order("starts_at");
    return {
      courses: courses.map((c) => ({ ...c, sessions: (sessions ?? []).filter((s) => s.course_id === c.id) })),
    };
  },
  ["landing"],
  { tags: ["landing"], revalidate: 60 },
);
