import Link from "next/link";
import { quizContext, rpc } from "@/lib/quiz";
import { createClient } from "@/lib/supabase/server";
import StartForm from "../start-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { course, enrollment } = await quizContext();
  const cfg = course.config as Record<string, number>;
  const { data: gate } = await rpc().rpc("final_gate", { p_enrollment: enrollment.id });
  const supabase = await createClient();
  const { data: attempts } = await supabase.from("quiz_attempts").select("id, attempt_no, score_pct, passed, submitted_at").eq("enrollment_id", enrollment.id).eq("type", "final").order("attempt_no");
  const extra = enrollment.mcq_extra_attempts ?? 0;
  const used = (attempts ?? []).filter((a) => a.submitted_at).length;
  const open = (attempts ?? []).find((a) => !a.submitted_at);
  const passed = (attempts ?? []).some((a) => a.passed);
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Link className="text-sm underline" href="/dashboard">&larr; Dashboard</Link>
      <h1 className="mt-2 text-2xl font-semibold">Kuiz akhir</h1>
      <p className="mt-2 text-sm">{cfg.mcq_count} soalan daripada semua bab. Markah lulus {cfg.pass_mark_mcq}%. Had percubaan: {cfg.max_mcq_attempts + extra} (digunakan {used}).</p>
      {!gate?.open ? (
        <p role="status" className="mt-4 rounded border border-amber-500 p-3">Kuiz akhir dibuka selepas setiap video dicapai ({gate?.videos_done ?? 0} / {gate?.videos_total ?? 0} video selesai).</p>
      ) : passed ? (
        <p className="mt-4 rounded border border-green-600 p-3">Anda telah lulus kuiz akhir. Teruskan ke bahagian 2.</p>
      ) : used >= cfg.max_mcq_attempts + extra ? (
        <p className="mt-4 rounded border border-red-500 p-3">Had percubaan telah habis. Hubungi admin.</p>
      ) : (
        <StartForm label={open ? "Sambung percubaan" : "Mula percubaan"} />
      )}
      {(attempts ?? []).some((a) => a.submitted_at) && (
        <section className="mt-6"><h2 className="font-medium">Keputusan terdahulu</h2>
          <ul className="mt-1 text-sm">{(attempts ?? []).filter((a) => a.submitted_at).map((a) => (
            <li key={a.id}>Percubaan {a.attempt_no}: {a.score_pct}% ({a.passed ? "lulus" : "gagal"})</li>))}</ul>
        </section>
      )}
    </main>
  );
}
