import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCourse } from "@/lib/course";
import { enrollmentFor } from "@/lib/learning";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { BorangForm, VideoForm } from "./forms";

export const dynamic = "force-dynamic";
// Notis wajib (CLAUDE.md bahagian 5): kekal sehingga kelulusan direkod. Boleh diganti melalui config, tetapi default MESTI mengandungi amaran ini.
const WAITING = "Menunggu pengesahan AHZ. Jangan masukkan bekalan.";
const PRIVACY_DEFAULT = "Video pengujian dihantar ke satu Telegram group bersama peserta praktikal lain. Semua ahli group boleh melihat video anda, dan membuang ahli daripada group tidak memadam mesej lama. (DRAF: teks sebenar menunggu AHZ.)";
const fmt = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));
const ST = { pending: "Menunggu semakan", approved: "Disemak: diterima", rejected: "Ditolak, sila hantar semula" } as const;

export default async function Page() {
  const p = await requireRole(["student"]);
  const course = await getCourse();
  if (!course) redirect("/dashboard");
  const { enrollment, active } = await enrollmentFor(course.id);
  if (!enrollment || enrollment.cert_track !== "theory_practical") redirect("/dashboard");
  const supabase = await createClient();
  const { data: subs } = await supabase.from("submissions").select("id, type, status, comment, attempt_no, external_ref, declared_at").eq("enrollment_id", enrollment.id).in("type", ["form", "video"]).order("attempt_no", { ascending: false });
  const latest = (t: string) => (subs ?? []).find((s) => s.type === t);
  const form = latest("form"), video = latest("video");
  const { data: e } = await supabase.from("enrollments").select("energize_approved_at, practical_result, practical_comment, telegram_invite_link").eq("id", enrollment.id).single();
  const cfg = course.config as Record<string, unknown>;
  const done = e?.practical_result === "lulus";
  const approved = !!e?.energize_approved_at;
  // Teks panduan keselamatan: SALINAN yang direkod semasa kelulusan (admin_actions), bukan config semasa.
  let guidance = "";
  if (approved) {
    const { data: act } = await adminClient().from("admin_actions").select("detail").eq("enrollment_id", enrollment.id).eq("action", "energize_approval").order("id", { ascending: false }).limit(1).maybeSingle();
    guidance = String((act?.detail as Record<string, unknown> | null)?.guidance_text ?? "");
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Link className="text-sm underline" href="/dashboard">&larr; Dashboard</Link>
      <h1 className="mt-2 text-2xl font-semibold">Praktikal</h1>
      <p className="text-sm">{p.fullName}</p>

      {done ? (
        <p role="status" className="mt-3 rounded border border-green-600 p-3">Keputusan praktikal: LULUS.{e?.practical_comment ? ` ${e.practical_comment}` : ""}</p>
      ) : approved ? (
        <section role="status" className="mt-3 rounded border border-green-600 p-3">
          <p className="font-medium">Kebenaran memasukkan bekalan telah direkodkan oleh AHZ pada {fmt(e!.energize_approved_at!)}.</p>
          {guidance && <p className="mt-2 whitespace-pre-wrap text-sm">{guidance}</p>}
          <p className="mt-2 text-sm">Selepas itu, penilai akan merekod keputusan praktikal anda.</p>
        </section>
      ) : (
        <p role="status" className="mt-3 rounded border border-red-600 p-3 font-medium text-red-700">{String(cfg.energize_waiting_notice ?? WAITING)}</p>
      )}

      {e?.practical_result === "belum" && <p className="mt-3 rounded border border-amber-500 p-3 text-sm">Keputusan terakhir: belum lulus. {e.practical_comment} Hantar semula borang dan video untuk semakan baharu.</p>}

      <ol className="mt-4 flex flex-col gap-3">
        <li className="rounded border p-3">
          <h2 className="font-medium">1. Borang bertandatangan</h2>
          {form ? <p className="text-sm">{ST[form.status as keyof typeof ST]} (percubaan {form.attempt_no}). {form.comment && `Komen: ${form.comment}`} <a className="underline" href={`/api/submissions/${form.id}/file`} target="_blank">Lihat fail</a></p> : <p className="text-sm">Belum dihantar.</p>}
          {!done && active && form?.status !== "pending" && <BorangForm />}
          {form?.status === "pending" && <p className="mt-1 text-xs">Sedang disemak: hantar semula hanya selepas semakan selesai.</p>}
        </li>
        <li className="rounded border p-3">
          <h2 className="font-medium">2. Tugasan pada papan (TANPA bekalan)</h2>
          <p className="text-sm">{String(cfg.practical_task_text ?? "PENANDA TEMPAT: arahan tugasan praktikal daripada AHZ (Ujian Amali Papan Bay).")}</p>
        </li>
        <li className="rounded border p-3">
          <h2 className="font-medium">3. Video pengujian ke Telegram group</h2>
          {e?.telegram_invite_link ? <p className="text-sm"><a className="underline" href={e.telegram_invite_link}>Pautan jemputan Telegram group</a></p> : <p className="text-sm">Pautan jemputan belum disediakan. Hubungi AHZ.</p>}
          {video ? <p className="mt-1 text-sm">{ST[video.status as keyof typeof ST]} (percubaan {video.attempt_no}). Rujukan: {video.external_ref}. {video.comment && `Komen: ${video.comment}`}</p> : <p className="mt-1 text-sm">Belum diisytiharkan.</p>}
          {!done && active && form && form.status !== "rejected" && video?.status !== "pending" && <VideoForm notice={String(cfg.telegram_privacy_notice ?? PRIVACY_DEFAULT)} />}
          {!form && <p className="mt-1 text-xs">Hantar borang dahulu.</p>}
        </li>
      </ol>
    </main>
  );
}
