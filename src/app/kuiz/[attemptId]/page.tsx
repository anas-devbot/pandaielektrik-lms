import Link from "next/link";
import { notFound } from "next/navigation";
import { quizContext, rpc } from "@/lib/quiz";
import { hantar } from "../actions";
import { buttonClass } from "@/components/button";

export const dynamic = "force-dynamic";

type Opt = { id: string; label: string; body: string };
type Q = { id: string; body: string; options: Opt[]; explanation?: string; correct_option_id?: string; chosen_option_id?: string };

export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();
  const { enrollment } = await quizContext();
  // Muatan daripada fungsi DB: TIADA is_correct. Jawapan hanya dipaparkan selepas percubaan dihantar.
  const { data: a, error } = await rpc().rpc("get_attempt", { p_attempt: attemptId, p_enrollment: enrollment.id });
  if (error || !a) notFound();
  const questions = a.questions as Q[];

  if (a.submitted) {
    return (
      <main className="mx-auto w-full max-w-2xl p-6">
        <h1 className="text-2xl font-semibold">Keputusan ujian akhir</h1>
        <p className="mt-2 text-xl">{a.score_pct}%{a.passed ? " · Lulus" : " · Gagal"}</p>
        {!a.passed && <p className="mt-1 text-sm">Anda boleh cuba lagi jika masih ada percubaan. Jawapan ujian akhir tidak dipaparkan.</p>}
        <Link className="mt-6 inline-block underline" href="/kuiz/akhir">Kembali</Link>
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Ujian akhir (percubaan {a.attempt_no})</h1>
      <form action={hantar} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="attempt" value={attemptId} />
        {questions.map((q, i) => (
          <fieldset key={q.id} className="rounded-md border border-border bg-surface p-3">
            <legend className="px-1 font-medium">{i + 1}. {q.body}</legend>
            {q.options.map((o) => (
              <label key={o.id} className="mt-1 flex items-start gap-2 text-sm">
                <input type="radio" name={`q_${q.id}`} value={o.id} className="mt-1" /><span>{o.body}</span>
              </label>))}
          </fieldset>
        ))}
        <button className={buttonClass("primary")}>Hantar jawapan</button>
      </form>
    </main>
  );
}
