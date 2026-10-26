import { adminClient } from "@/lib/supabase/admin";
import { enrollmentFor } from "@/lib/learning";

// Klien hanya melapor kedudukan; SERVER yang memutuskan berapa saat unik dikira (record_heartbeat).
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { lessonId?: unknown; position?: unknown } | null;
  const lessonId = body?.lessonId, position = body?.position;
  if (typeof lessonId !== "string" || !/^[0-9a-f-]{36}$/i.test(lessonId) || !Number.isInteger(position) || (position as number) < 0 || (position as number) > 86400)
    return json({ error: "bad_request" }, 400);

  const db = adminClient();
  const { data: lesson } = await db.from("lessons").select("id, course_id").eq("id", lessonId).maybeSingle();
  if (!lesson) return json({ error: "not_found" }, 404);
  const { user, enrollment, active } = await enrollmentFor(lesson.course_id);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (!enrollment) return json({ error: "not_enrolled" }, 403);
  if (!active) return json({ error: "access_closed" }, 403);

  const { data, error } = await db.rpc("record_heartbeat", { p_enrollment: enrollment.id, p_lesson: lesson.id, p_position: position as number });
  if (error) return json({ error: error.message === "access_closed" ? "access_closed" : "server" }, error.message === "access_closed" ? 403 : 500);
  return json(data);
}
