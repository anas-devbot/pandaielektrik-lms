import Link from "next/link";
import { quizContext } from "@/lib/quiz";
import { createClient } from "@/lib/supabase/server";
import Part2Form from "./form";

export const dynamic = "force-dynamic";
const LABEL = { subjective: "Subjektif", schematic: "Skematik" } as const;

export default async function Page() {
  const { course, enrollment } = await quizContext();
  const cfg = course.config as Record<string, unknown>;
  const maxMb = Number(cfg.schematic_max_mb);
  const supabase = await createClient();
  const { data: subs } = await supabase.from("submissions")
    .select("id, type, status, comment, attempt_no, source, received_at, created_at")
    .eq("enrollment_id", enrollment.id).in("type", ["subjective", "schematic"]).order("attempt_no", { ascending: false });
  const latest = (t: string) => (subs ?? []).find((s) => s.type === t);
  const open = enrollment.stage === "part2_review";

  const row = (t: "subjective" | "schematic") => {
    const s = latest(t);
    return (
      <li key={t} className="rounded border p-3">
        <p className="font-medium">{LABEL[t]}</p>
        {!s ? <p className="text-sm">Belum dihantar.</p> : (
          <>
            <p className="text-sm">
              {s.status === "pending" && "Menunggu semakan"}{s.status === "approved" && "Lulus"}{s.status === "rejected" && "Ditolak, sila hantar semula"}
              {` (percubaan ${s.attempt_no})`}{s.source === "manual_fasi" && ` · Dihantar (manual) pada ${s.received_at}`}
            </p>
            {s.comment && <p className="mt-1 text-sm">Komen penilai: {s.comment}</p>}
            {t === "schematic" && s.source === "lms" && <a className="text-sm underline" href={`/api/submissions/${s.id}/file`} target="_blank">Lihat fail anda</a>}
          </>
        )}
      </li>
    );
  };
  const needText = open && (!latest("subjective") || latest("subjective")?.status === "rejected");
  const needFile = open && (!latest("schematic") || latest("schematic")?.status === "rejected");

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Link className="text-sm underline" href="/dashboard">&larr; Dashboard</Link>
      <h1 className="mt-2 text-2xl font-semibold">Bahagian 2: subjektif dan skematik</h1>
      {!open && enrollment.stage !== "theory_passed" && enrollment.stage !== "practical" && enrollment.stage !== "completed"
        ? <p role="status" className="mt-3 rounded border border-amber-500 p-3">Bahagian 2 dibuka selepas kuiz akhir lulus.</p>
        : <>
            <p className="mt-2 text-sm">Kedua-dua item wajib. Penilai memberi keputusan lulus atau tolak dengan komen. Jika ditolak, anda boleh hantar semula. Skematik boleh dilukis orang lain.</p>
            {/* Soalan sebenar daripada AHZ dalam config (subjective_prompt / schematic_prompt): belum disediakan */}
            <section className="mt-3 rounded border p-3 text-sm">
              <p><b>Soalan subjektif:</b> {String(cfg.subjective_prompt ?? "PENANDA TEMPAT: soalan subjektif menunggu AHZ")}</p>
              <p className="mt-1"><b>Arahan skematik:</b> {String(cfg.schematic_prompt ?? "PENANDA TEMPAT: arahan skematik menunggu AHZ")}</p>
            </section>
          </>}
      <ul className="mt-4 flex flex-col gap-2">{row("subjective")}{row("schematic")}</ul>
      {(needText || needFile) && <Part2Form needText={needText} needFile={needFile} maxMb={Number.isFinite(maxMb) ? maxMb : 10} />}
      {enrollment.stage === "theory_passed" && <p className="mt-4 rounded border border-green-600 p-3">Bahagian 2 lulus. Teori lulus.</p>}
    </main>
  );
}
