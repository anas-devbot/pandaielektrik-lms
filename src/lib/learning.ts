import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Enrollment pengguna semasa untuk satu kursus (RLS: milik sendiri). `active` = belum tamat dan belum refund. */
export async function enrollmentFor(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, enrollment: null, active: false };
  const { data: enrollment } = await supabase.from("enrollments")
    .select("id, stage, access_ends_at, refunded_at, cert_track").eq("user_id", user.id).eq("course_id", courseId).maybeSingle();
  const active = !!enrollment && !enrollment.refunded_at && new Date(enrollment.access_ends_at) > new Date();
  return { user, enrollment, active };
}
