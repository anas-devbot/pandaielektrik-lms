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

// Data awam landing (kursus + sesi akan datang). Tiada cookie, jadi boleh di-cache: anon key sahaja, RLS awam (public read).
// Dibatalkan bila admin ubah kursus/sesi (tag "landing", lihat admin/ops.ts). ponytail: TTL 60s sebagai jaring kalau tag terlepas.
// Had: penapis "akan datang" dikira semasa cache diisi, jadi sesi yang baru tamat boleh kekal ≤60s.
export const getLanding = unstable_cache(
  async () => {
    const db = createPublicClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data: course } = await db.from("courses").select("id, slug, title, price, currency, config").order("created_at").limit(1).maybeSingle();
    if (!course) return { course: null, sessions: [] };
    const { data: sessions } = await db.from("course_sessions").select("id, starts_at, ends_at, venue_or_link, capacity, status")
      .eq("course_id", course.id).in("status", ["open", "full"]).gte("starts_at", new Date().toISOString()).order("starts_at");
    return { course, sessions: sessions ?? [] };
  },
  ["landing"],
  { tags: ["landing"], revalidate: 60 },
);
