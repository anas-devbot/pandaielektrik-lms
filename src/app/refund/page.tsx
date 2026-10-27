import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCourse } from "@/lib/course";
import { enrollmentFor } from "@/lib/learning";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { MohonForm, SuratForm } from "./forms";

export const dynamic = "force-dynamic";
const fmt = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));
const Item = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => <li>{ok ? "✔ " : "✘ "}{children}</li>;

export default async function Page() {
  await requireRole(["student"]);
  const course = await getCourse(); if (!course) redirect("/dashboard");
  const { enrollment } = await enrollmentFor(course.id);
  if (!enrollment) redirect("/dashboard");
  const supabase = await createClient();
  const { data: reqs } = await supabase.from("refund_requests").select("id, status, reason, override_note, decision_note, created_at, auto_check_snapshot, refunded_at").eq("enrollment_id", enrollment.id).order("created_at", { ascending: false });
  const current = (reqs ?? [])[0];
  const { data: snap } = await adminClient().rpc("refund_eligibility", { p_enrollment: enrollment.id });   // tiada bayaran = null (tiada refund)

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Link className="text-sm underline" href="/dashboard">&larr; Dashboard</Link>
      <h1 className="mt-2 text-2xl font-semibold">Refund</h1>
      <p className="mt-1 text-sm">Refund tertakluk kepada <Link className="underline" href="/terma" target="_blank">terma dan syarat</Link>.</p>

      {enrollment.refunded_at ? (
        <p role="status" className="mt-4 rounded border border-green-600 p-3">Refund telah diproses pada {fmt(enrollment.refunded_at)}. Akses ditutup dan sijil (jika ada) dibatalkan.</p>
      ) : !snap ? (
        <p className="mt-4 text-sm">Tiada bayaran direkodkan untuk pendaftaran ini, jadi refund tidak terpakai.</p>
      ) : (
        <>
          <section className="mt-4 rounded border p-3">
            <h2 className="font-medium">Semakan kelayakan</h2>
            <ul className="mt-1 text-sm">
              <Item ok={snap.window_ok}>Dalam tempoh {snap.window_days} hari dari bayaran (sehingga {fmt(snap.deadline)}).</Item>
              <Item ok={snap.progress_ok}>Progres video {snap.progress_pct}% (mesti kurang daripada {snap.progress_max_pct}%).</Item>
              <Item ok={snap.no_submissions}>Tiada penghantaran (subjektif, skematik, borang, video).</Item>
              <Item ok={snap.no_final_attempt}>Tiada percubaan MCQ akhir.</Item>
              {snap.pdf_max !== null && <Item ok={snap.pdf_ok}>Akses PDF {snap.pdf_downloads} kali (had {snap.pdf_max}).</Item>}
            </ul>
          </section>

          {!current || ["rejected"].includes(current.status) ? (
            <>
              {current?.status === "rejected" && <p className="mt-3 rounded border border-amber-500 p-3 text-sm">Permohonan terdahulu ditolak.{current.decision_note ? ` Sebab: ${current.decision_note}` : ""}</p>}
              {snap.window_ok ? <MohonForm /> : <p className="mt-4 rounded border border-amber-500 p-3 text-sm">Tempoh permohonan refund telah tamat.</p>}
            </>
          ) : (
            <section className="mt-4 rounded border p-3">
              <h2 className="font-medium">Permohonan anda ({fmt(current.created_at)})</h2>
              {current.status === "auto_failed" && <p role="status" className="mt-1 text-sm">Permohonan tidak lulus semakan automatik, jadi surat refund tidak dikeluarkan. Sila hubungi admin AHZ.</p>}
              {current.status === "letter_issued" && (
                <>
                  <p className="mt-1 text-sm">Langkah seterusnya: <a className="underline" href={`/api/refund/${current.id}/surat`}>muat turun surat refund</a>, tandatangan, kemudian muat naik foto atau imbasannya.</p>
                  {current.override_note && <p className="text-xs">Diluluskan untuk diteruskan oleh admin.</p>}
                  <SuratForm request={current.id} />
                </>
              )}
              {current.status === "letter_uploaded" && <p role="status" className="mt-1 text-sm">Surat diterima. Menunggu semakan admin. <a className="underline" href={`/api/refund/${current.id}/surat`}>Surat</a> · <a className="underline" href={`/api/refund/${current.id}/fail`} target="_blank">Surat bertandatangan anda</a></p>}
              {current.status === "approved" && <p role="status" className="mt-1 text-sm">Permohonan diluluskan. AHZ akan memproses refund secara manual. Akses anda kekal sehingga refund dipulangkan.</p>}
            </section>
          )}
        </>
      )}
    </main>
  );
}
