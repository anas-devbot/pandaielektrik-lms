import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getCourse } from "@/lib/course";
import { enrollmentFor } from "@/lib/learning";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { logKeluar } from "@/app/log-masuk/actions";
import SijilForm from "@/app/sijil/form";
import { PilihTrekForm } from "@/app/praktikal/forms";

export const dynamic = "force-dynamic";

const STEP: Record<string, string> = {
  enrolled: "Tonton semua video dalam setiap bab. MCQ akhir dibuka selepas setiap video dicapai.",
  learning: "Tonton semua video dalam setiap bab. MCQ akhir dibuka selepas setiap video dicapai.",
  final_mcq: "Jawab MCQ akhir.",
  part2_review: "MCQ akhir lulus. Hantar subjektif dan skematik (bahagian 2).",
  theory_passed: "Bahagian 2 lulus. Teori lulus. Pilih trek di bawah.",
  practical: "Trek praktikal: ikut langkah di halaman praktikal. Menunggu pengesahan AHZ. Jangan masukkan bekalan.",
  completed: "Tahniah, program selesai.",
};

export default async function Page() {
  const p = await requireRole(["student"]);
  const course = await getCourse();
  const { enrollment, active } = course ? await enrollmentFor(course.id) : { enrollment: null, active: false };
  const fmt = new Intl.DateTimeFormat("ms-MY", { dateStyle: "long", timeZone: "Asia/Kuala_Lumpur" });

  if (!course || !enrollment) {
    return (
      <main className="mx-auto w-full max-w-2xl p-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2">Selamat datang, {p.fullName}. Anda belum mendaftar dalam kursus.</p>
        <Link href="/beli" className="mt-4 inline-block rounded bg-black px-4 py-2 text-white">Daftar dan bayar</Link>
      </main>
    );
  }

  const db = adminClient(); // senarai tajuk sahaja; video_ref dan r2_key TIDAK dihantar ke halaman ini
  const [{ data: chapters }, { data: lessons }, { data: materials }] = await Promise.all([
    db.from("chapters").select("id, position, title").eq("course_id", course.id).order("position"),
    db.from("lessons").select("id, chapter_id, position, title, duration_seconds, urutan_global").eq("course_id", course.id).order("urutan_global", { ascending: true, nullsFirst: false }),
    db.from("materials").select("id, chapter_id, title").eq("course_id", course.id).order("title"),
  ]);
  const supabase = await createClient();
  const { data: practice } = await db.from("quiz_questions").select("chapter_id").eq("course_id", course.id).eq("type", "practice");
  const practiceChapters = new Set((practice ?? []).map((q) => q.chapter_id));
  const { data: gate } = await db.rpc("final_gate", { p_enrollment: enrollment.id });
  const { data: finals } = await supabase.from("quiz_attempts").select("score_pct, passed, submitted_at").eq("enrollment_id", enrollment.id).eq("type", "final").not("submitted_at", "is", null);
  const { data: certs } = await supabase.from("certificates").select("id, type, cert_id, verify_token, revoked_at, issued_at").eq("enrollment_id", enrollment.id).order("issued_at", { ascending: false });
  const validCert = (certs ?? []).find((c) => !c.revoked_at);
  const theoryReady = enrollment.cert_track !== "theory_practical" && ["theory_passed", "completed"].includes(enrollment.stage);
  const practicalReady = enrollment.cert_track === "theory_practical" && enrollment.practical_result === "lulus" && ["practical", "completed"].includes(enrollment.stage);
  const canIssue = !validCert && !enrollment.refunded_at && (theoryReady || practicalReady);
  const choosingTrack = !enrollment.refunded_at && enrollment.stage === "theory_passed" && !enrollment.cert_track;
  const onPractical = enrollment.cert_track === "theory_practical";
  // Refund: pautan dipaparkan dalam tempoh refund (tanpa bayaran = rpc ralat = tiada pautan)
  const { data: refundSnap } = enrollment.refunded_at ? { data: null } : await db.rpc("refund_eligibility", { p_enrollment: enrollment.id });
  const { count: refundReqs } = await supabase.from("refund_requests").select("*", { count: "exact", head: true }).eq("enrollment_id", enrollment.id);
  const { data: prog } = await supabase.from("lesson_progress").select("lesson_id, watched_seconds_unique, completed_at").eq("enrollment_id", enrollment.id);
  const byLesson = new Map((prog ?? []).map((r) => [r.lesson_id, r]));
  const pct = Number((course.config as Record<string, unknown>).video_complete_pct ?? 0.9);
  const done = (lessons ?? []).filter((l) => byLesson.get(l.id)?.completed_at).length;
  const total = lessons?.length ?? 0;
  const ends = new Date(enrollment.access_ends_at);
  // Tarikh sesi sahaja. Pautan Google Meet dan Telegram TIDAK dipapar di sini: dimaklumkan dalam group WhatsApp DIY ELEKTRIK.
  const { data: liveSessions } = active ? await db.from("course_sessions").select("id, starts_at").eq("course_id", course.id).in("status", ["open", "full"]).gte("starts_at", new Date().toISOString()).order("starts_at") : { data: null };
  const chapterById = new Map((chapters ?? []).map((c) => [c.id, c]));
  const fmtLive = new Intl.DateTimeFormat("ms-MY", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" });

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">{course.title}</h1>
      <p className="mt-1 text-sm">{p.fullName}</p>
      {enrollment.refunded_at ? (
        <p role="status" className="mt-3 rounded border border-red-500 p-3">Akses ditutup (refund).</p>
      ) : active ? (
        <p className="mt-3 text-sm">Akses sehingga {fmt.format(ends)}.</p>
      ) : (
        <p role="status" className="mt-3 rounded border border-amber-500 p-3">Akses video dan bahan tamat pada {fmt.format(ends)}. Sijil dan rekod anda kekal sah.</p>
      )}

      <section className="mt-4 rounded border p-3">
        <h2 className="font-medium">Anda di langkah ini</h2>
        <p className="mt-1 text-sm">{STEP[enrollment.stage] ?? STEP.enrolled}</p>
        <p className="mt-1 text-sm">Video selesai: {done} / {total} (selesai = {Math.round(pct * 100)}% saat unik ditonton).</p>
      </section>

      {onPractical && enrollment.practical_result !== "lulus" && (
        <section className="mt-4 rounded border p-3">
          <h2 className="font-medium">Trek praktikal</h2>
          <Link className="mt-1 inline-block text-sm underline" href="/praktikal">Buka halaman praktikal</Link>
        </section>
      )}
      {choosingTrack && (
        <section className="mt-4 rounded border p-3">
          <h2 className="font-medium">Pilih trek</h2>
          <p className="mt-1 text-sm">Anda boleh memilih trek teori sahaja (sijil di bawah) atau trek teori dan praktikal. Pilihan tidak boleh ditukar.</p>
          <PilihTrekForm />
        </section>
      )}
      {(validCert || canIssue) && (
        <section className="mt-4 rounded border p-3">
          <h2 className="font-medium">Sijil</h2>
          {validCert ? (
            <p className="mt-1 text-sm">
              {validCert.type === "theory_practical" ? "Sijil teori dan praktikal" : "Sijil teori"}. ID {validCert.cert_id}. <a className="underline" href={`/api/sijil/${validCert.id}`}>Muat turun PDF</a> ·{" "}
              <a className="underline" href={`/semak/${validCert.verify_token}`}>Halaman semakan awam</a>
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm">{practicalReady ? "Praktikal lulus. Anda boleh mengeluarkan Sijil Teori dan Praktikal anda." : "Bahagian 2 lulus. Anda boleh mengeluarkan sijil teori anda."}</p>
              <SijilForm defaultName={p.fullName} />
            </>
          )}
        </section>
      )}
      {active && ["part2_review", "theory_passed"].includes(enrollment.stage) && (
        <section className="mt-4 rounded border p-3">
          <h2 className="font-medium">Bahagian 2</h2>
          <Link className="mt-1 inline-block text-sm underline" href="/bahagian2">Subjektif dan skematik</Link>
        </section>
      )}
      {active && (
        <section className="mt-4 rounded border p-3">
          <h2 className="font-medium">MCQ akhir</h2>
          {finals?.some((f) => f.passed) ? <p className="mt-1 text-sm">Lulus ({finals.find((f) => f.passed)?.score_pct}%).</p>
            : gate?.open ? <Link className="mt-1 inline-block text-sm underline" href="/kuiz/akhir">Buka MCQ akhir</Link>
            : <p className="mt-1 text-sm">Dibuka selepas setiap video dicapai ({gate?.videos_done ?? 0} / {gate?.videos_total ?? 0}).</p>}
        </section>
      )}

      {active && (
        <section className="mt-6 rounded border p-3">
          <h2 className="font-medium">Sesi live dan chat</h2>
          {(liveSessions ?? []).length === 0 ? <p className="mt-1 text-sm">Tiada sesi live akan datang buat masa ini.</p> : (
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {(liveSessions ?? []).map((s) => (
                <li key={s.id}>{fmtLive.format(new Date(s.starts_at))}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm">Pautan Google Meet untuk sesi live dan pautan group Telegram chat dengan trainer dan fasilitator AHZ dimaklumkan dalam group WhatsApp DIY ELEKTRIK.</p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Video mengikut turutan</h2>
        <p className="mt-1 text-sm">Disyorkan tonton mengikut nombor ini.</p>
        <ol className="mt-2 flex flex-col gap-2">
          {(lessons ?? []).map((l) => {
            const r = byLesson.get(l.id);
            const w = r ? Math.min(100, Math.round((r.watched_seconds_unique / l.duration_seconds) * 100)) : 0;
            const ch = chapterById.get(l.chapter_id);
            return (
              <li key={l.id} className="rounded border p-3">
                <span className="mr-2 text-sm">{l.urutan_global ?? "-"}.</span>
                {active ? <Link className="underline" href={`/belajar/${l.id}`}>{l.title}</Link> : <span>{l.title}</span>}
                <span className="ml-2 text-sm">{r?.completed_at ? "Selesai" : `${w}%`}</span>
                <p className="mt-1 text-xs">Bab {ch?.position}: {ch?.title}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {(chapters ?? []).map((c) => (
        <section key={c.id} className="mt-6">
          <h2 className="text-lg font-medium">Bab {c.position}: {c.title}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {active && practiceChapters.has(c.id) && (
              <li className="rounded border p-3 text-sm"><Link className="underline" href={`/kuiz/bab/${c.id}`}>Kuiz latihan bab ini</Link></li>
            )}
            {(materials ?? []).filter((m) => m.chapter_id === c.id).map((m) => (
              <li key={m.id} className="rounded border p-3 text-sm">
                {active ? <a className="underline" href={`/api/materials/${m.id}`}>PDF: {m.title}</a> : <span>PDF: {m.title} (akses tamat)</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {/* Bahan peringkat kursus (chapter_id kosong), contohnya ebook untuk rujukan offline. Muat turun melalui /api/materials yang sama. */}
      {(materials ?? []).some((m) => !m.chapter_id) && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Bahan kursus</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {(materials ?? []).filter((m) => !m.chapter_id).map((m) => (
              <li key={m.id} className="rounded border p-3 text-sm">
                {active ? <a className="underline" href={`/api/materials/${m.id}`}>PDF: {m.title} (muat turun)</a> : <span>PDF: {m.title} (akses tamat)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!enrollment.refunded_at && refundSnap && (refundSnap.window_ok || (refundReqs ?? 0) > 0) && (
        <p className="mt-8 text-xs">Soalan tentang bayaran atau refund? <Link className="underline" href="/refund">{refundSnap.window_ok ? `Refund dan bantuan (sehingga ${fmt.format(new Date(refundSnap.deadline))})` : "Status permohonan refund"}</Link></p>
      )}
      <form action={logKeluar} className="mt-8"><button className="underline">Log keluar</button></form>
    </main>
  );
}
