import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { enrollmentFor } from "@/lib/learning";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import Player from "./player";
import { LessonNav } from "./lesson-nav";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) notFound();
  const p = await requireRole(["student"]);
  const db = adminClient();
  const { data: lesson } = await db.from("lessons").select("id, course_id, title, video_provider, video_ref, duration_seconds, urutan_global").eq("id", lessonId).maybeSingle();
  if (!lesson) notFound();
  const { enrollment, active } = await enrollmentFor(lesson.course_id);
  if (!enrollment) notFound();
  if (!active) {
    // video_ref TIDAK dihantar bila akses tamat atau refund
    return (
      <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        <h1 className="font-serif text-xl font-semibold">{lesson.title}</h1>
        <p role="status" className="mt-3 rounded-md border bg-surface border-warning p-3">Akses video telah tamat.</p>
        <Link className="mt-4 inline-block underline" href="/dashboard">Kembali</Link>
      </main>
    );
  }
  const supabase = await createClient();
  const { data: prog } = await supabase.from("lesson_progress").select("watched_seconds_unique, completed_at").eq("enrollment_id", enrollment.id).eq("lesson_id", lesson.id).maybeSingle();
  // Video seterusnya mengikut turutan (disyorkan, bukan dikunci)
  const { data: nextLesson } = lesson.urutan_global != null
    ? await db.from("lessons").select("id, title, urutan_global").eq("course_id", lesson.course_id).gt("urutan_global", lesson.urutan_global).order("urutan_global").limit(1).maybeSingle()
    : { data: null };
  const { count: lessonTotal } = await db.from("lessons").select("*", { count: "exact", head: true }).eq("course_id", lesson.course_id);
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div className="flex items-center gap-3 text-sm text-muted">
        <Link className="rounded-full border border-border bg-surface px-3 py-1.5 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-info" href="/dashboard">&larr; Dashboard</Link>
        {lesson.urutan_global != null && lessonTotal ? <span>Video {lesson.urutan_global} daripada {lessonTotal}</span> : null}
      </div>
      <h1 className="mt-3 font-serif text-xl font-semibold leading-snug">{lesson.title}</h1>
      <Player lessonId={lesson.id} provider={lesson.video_provider} videoRef={lesson.video_ref} duration={lesson.duration_seconds}
        watermark={`${p.fullName} · ${p.email}`} initialWatched={prog?.watched_seconds_unique ?? 0} initialDone={!!prog?.completed_at} />
      <LessonNav next={nextLesson ? { id: nextLesson.id, no: nextLesson.urutan_global, title: nextLesson.title } : null} />
    </main>
  );
}
