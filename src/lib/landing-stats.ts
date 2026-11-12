import { unstable_cache } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";
import { shapeStats, type LandingStats } from "@/lib/landing-shape";

export type { LandingStats };

// Hanya bilangan dan nilai config dipulangkan. video_ref dan r2_key TIDAK dibaca.
// Dibatalkan melalui tag "landing" bila admin ubah katalog; TTL 300s sebagai jaring.
export const getLandingStats = unstable_cache(
  async (courseId: string): Promise<LandingStats> => {
    const db = adminClient();
    const [l, c, course] = await Promise.all([
      db.from("lessons").select("*", { count: "exact", head: true }).eq("course_id", courseId),
      db.from("chapters").select("*", { count: "exact", head: true }).eq("course_id", courseId),
      db.from("courses").select("config").eq("id", courseId).maybeSingle(),
    ]);
    return shapeStats({ lessons: l.count ?? 0, chapters: c.count ?? 0, config: (course.data?.config as Record<string, unknown> | null) ?? null });
  },
  ["landing-stats"],
  { tags: ["landing"], revalidate: 300 },
);
