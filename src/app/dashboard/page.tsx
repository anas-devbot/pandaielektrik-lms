import Image from "next/image";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getCourse } from "@/lib/course";
import { enrollmentFor } from "@/lib/learning";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { logKeluar } from "@/app/log-masuk/actions";
import SijilForm from "@/app/sijil/form";
import { PilihTrekForm } from "@/app/praktikal/forms";
import { buttonClass } from "@/components/button";

export const dynamic = "force-dynamic";

const STEP: Record<string, string> = {
  enrolled: "Muat turun ebook, kemudian tonton semua video mengikut senarai. Ujian akhir dibuka selepas setiap video dicapai.",
  learning: "Muat turun ebook, kemudian tonton semua video mengikut senarai. Ujian akhir dibuka selepas setiap video dicapai.",
  final_mcq: "Jawab ujian akhir.",
  part2_review: "Ujian akhir lulus. Hantar subjektif dan skematik (bahagian 2).",
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
        <Link href="/beli" className={buttonClass("primary", "mt-4 sm:w-auto")}>Daftar dan bayar</Link>
      </main>
    );
  }

  const db = adminClient(); // senarai tajuk sahaja; video_ref dan r2_key TIDAK dihantar ke halaman ini
  const [{ data: lessons }, { data: materials }] = await Promise.all([
    db.from("lessons").select("id, chapter_id, position, title, duration_seconds, urutan_global").eq("course_id", course.id).order("urutan_global", { ascending: true, nullsFirst: false }),
    db.from("materials").select("id, chapter_id, title").eq("course_id", course.id).order("title"),
  ]);
  const supabase = await createClient();
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
  const { data: prog } = await supabase.from("lesson_progress").select("lesson_id, watched_seconds_unique, completed_at, last_heartbeat_at").eq("enrollment_id", enrollment.id);
  const byLesson = new Map((prog ?? []).map((r) => [r.lesson_id, r]));
  const pct = Number((course.config as Record<string, unknown>).video_complete_pct ?? 0.9);
  const done = (lessons ?? []).filter((l) => byLesson.get(l.id)?.completed_at).length;
  const total = lessons?.length ?? 0;
  const ends = new Date(enrollment.access_ends_at);
  // Tarikh sesi sahaja. Pautan Google Meet dan Telegram TIDAK dipapar di sini: dimaklumkan dalam group WhatsApp DIY ELEKTRIK.
  const { data: liveSessions } = active ? await db.from("course_sessions").select("id, starts_at").eq("course_id", course.id).in("status", ["open", "full"]).gte("starts_at", new Date().toISOString()).order("starts_at") : { data: null };
  // PDF peringkat bab (jika ada) dipapar tanpa nama bab. Kuiz latihan per bab tidak digunakan.
  const chapterPdfs = (materials ?? []).filter((m) => m.chapter_id);
  // Sambung tonton: video terakhir yang ditonton (belum selesai), atau video pertama yang belum selesai ikut turutan
  const lastTouched = (prog ?? []).filter((r) => r.last_heartbeat_at && !r.completed_at).sort((a, b) => ((b.last_heartbeat_at ?? "") > (a.last_heartbeat_at ?? "") ? 1 : -1))[0];
  const firstUnfinished = (lessons ?? []).find((l) => !byLesson.get(l.id)?.completed_at);
  const resume = active && done < total ? ((lessons ?? []).find((l) => l.id === lastTouched?.lesson_id) ?? firstUnfinished) : null;
  const pctDone = total ? Math.round((done / total) * 100) : 0;
  const daysLeft = Math.max(0, Math.ceil((ends.getTime() - new Date().getTime()) / 86400000));
  // Ebook: tarikh muat turun terakhir (material_access_log dibaca di server)
  const ebook = (materials ?? []).find((m) => !m.chapter_id);
  const { data: ebookLast } = ebook ? await db.from("material_access_log").select("accessed_at").eq("enrollment_id", enrollment.id).eq("material_id", ebook.id).order("accessed_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const fmtLive = new Intl.DateTimeFormat("ms-MY", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" });

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <header className="-mx-6 mb-6 flex items-center gap-3 border-b border-border px-6 pb-3">
        <Image src="/icon.png" alt="" width={32} height={32} className="size-8 rounded-full" />
        <span className="font-serif text-lg font-semibold">Pandai Elektrik</span>
        <form action={logKeluar} className="ml-auto"><button className="text-sm underline underline-offset-4">Log keluar</button></form>
      </header>
      <h1 className="text-2xl font-semibold">{course.title}</h1>
      <p className="mt-1 text-sm">{p.fullName}</p>
      {enrollment.refunded_at ? (
        <p role="status" className="mt-3 rounded-md border border-error p-3 text-error">Akses ditutup (refund).</p>
      ) : active ? (
        <p className="mt-3 text-sm">Akses sehingga {fmt.format(ends)}.</p>
      ) : (
        <p role="status" className="mt-3 rounded-md border border-warning p-3">Akses video dan bahan tamat pada {fmt.format(ends)}. Sijil dan rekod anda kekal sah.</p>
      )}

      <section className="mt-4 rounded-md border border-border bg-surface p-3">
        <h2 className="font-medium">Anda di langkah ini</h2>
        <p className="mt-1 text-sm">{STEP[enrollment.stage] ?? STEP.enrolled}</p>
        <div className="mt-3">
          <p className="text-sm">Video selesai: {done} / {total} ({pctDone}%)</p>
          <div className="mt-1 h-2 w-full rounded-full bg-border" role="progressbar" aria-valuenow={pctDone} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 rounded-full bg-ink" style={{ width: `${pctDone}%` }} />
          </div>
          <p className="mt-1 text-xs">Selesai = {Math.round(pct * 100)}% saat unik ditonton.</p>
        </div>
        {active && <p className="mt-2 text-sm">Baki akses: {daysLeft} hari.</p>}
        {resume && (
          <Link className={buttonClass("primary", "mt-3 sm:w-auto")} href={`/belajar/${resume.id}`}>
            Sambung tonton: <span>{resume.title}</span>
          </Link>
        )}
      </section>

      {onPractical && enrollment.practical_result !== "lulus" && (
        <section className="mt-4 rounded-md border border-border bg-surface p-3">
          <h2 className="font-medium">Trek praktikal</h2>
          <Link className="mt-1 inline-block text-sm underline" href="/praktikal">Buka halaman praktikal</Link>
        </section>
      )}
      {choosingTrack && (
        <section className="mt-4 rounded-md border border-border bg-surface p-3">
          <h2 className="font-medium">Pilih trek</h2>
          <p className="mt-1 text-sm">Anda boleh memilih trek teori sahaja (sijil di bawah) atau trek teori dan praktikal. Pilihan tidak boleh ditukar.</p>
          <PilihTrekForm />
        </section>
      )}
      {(validCert || canIssue) && (
        <section className="mt-4 rounded-md border border-border bg-surface p-3">
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
        <section className="mt-4 rounded-md border border-border bg-surface p-3">
          <h2 className="font-medium">Bahagian 2</h2>
          <Link className="mt-1 inline-block text-sm underline" href="/bahagian2">Subjektif dan skematik</Link>
        </section>
      )}
      {active && (
        <section className="mt-4 rounded-md border border-border bg-surface p-3">
          <h2 className="font-medium">Ujian akhir</h2>
          {finals?.some((f) => f.passed) ? <p className="mt-1 text-sm">Lulus ({finals.find((f) => f.passed)?.score_pct}%).</p>
            : gate?.open ? <Link className="mt-1 inline-block text-sm underline" href="/kuiz/akhir">Buka ujian akhir</Link>
            : <p className="mt-1 text-sm">Dibuka selepas setiap video dicapai ({gate?.videos_done ?? 0} / {gate?.videos_total ?? 0}).</p>}
        </section>
      )}

      {active && (
        <section className="mt-6 rounded-md border border-border bg-surface p-3">
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

      {/* Bahan peringkat kursus (chapter_id kosong), contohnya ebook. Dipapar DAHULU, sebelum video (permintaan AHZ). */}
      {(materials ?? []).some((m) => !m.chapter_id) && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Langkah 1: Ebook</h2>
          <p className="mt-1 text-sm">Muat turun ebook dahulu, kemudian tonton video mengikut turutan.</p>
          {active && <p className="mt-1 text-xs">{ebookLast ? `Terakhir dimuat turun: ${fmt.format(new Date(ebookLast.accessed_at))}` : "Belum dimuat turun."}</p>}
          <ul className="mt-2 flex flex-col gap-2">
            {(materials ?? []).filter((m) => !m.chapter_id).map((m) => (
              <li key={m.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                {active ? <a className="underline" href={`/api/materials/${m.id}`}>PDF: {m.title} (muat turun)</a> : <span>PDF: {m.title} (akses tamat)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Langkah 2: Video mengikut turutan</h2>
        <p className="mt-1 text-sm">Disyorkan tonton mengikut nombor ini.</p>
        <ol className="mt-2 flex flex-col gap-2">
          {(lessons ?? []).map((l) => {
            const r = byLesson.get(l.id);
            const w = r ? Math.min(100, Math.round((r.watched_seconds_unique / l.duration_seconds) * 100)) : 0;
            const done = !!r?.completed_at;
            const tahap = done ? 100 : w;
            return (
              <li key={l.id} className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
                <span className="w-8 shrink-0 pt-0.5 text-sm font-medium tabular-nums">{l.urutan_global ?? "-"}.</span>
                <div className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-medium">
                    {active ? <Link className="underline underline-offset-4" href={`/belajar/${l.id}`}>{l.title}</Link> : <span>{l.title}</span>}
                  </span>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-label={`Kemajuan ${l.title}`} aria-valuenow={tahap} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-1.5 rounded-full bg-ink" style={{ width: `${tahap}%` }} />
                  </div>
                </div>
                <span className="shrink-0 pt-0.5 text-sm tabular-nums">{done ? "Selesai" : `${tahap}%`}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {chapterPdfs.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Bahan tambahan</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {chapterPdfs.map((m) => (
              <li key={m.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                {active ? <a className="underline" href={`/api/materials/${m.id}`}>PDF: {m.title}</a> : <span>PDF: {m.title} (akses tamat)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!enrollment.refunded_at && refundSnap && (refundSnap.window_ok || (refundReqs ?? 0) > 0) && (
        <p className="mt-8 text-xs">Soalan tentang bayaran atau refund? <Link className="underline" href="/refund">{refundSnap.window_ok ? `Refund dan bantuan (sehingga ${fmt.format(new Date(refundSnap.deadline))})` : "Status permohonan refund"}</Link></p>
      )}
      {!enrollment.refunded_at && !(refundSnap && (refundSnap.window_ok || (refundReqs ?? 0) > 0)) && (
        <p className="mt-8 text-xs">Soalan tentang bayaran? Tanya admin atau fasilitator dalam group WhatsApp DIY ELEKTRIK.</p>
      )}
    </main>
  );
}
