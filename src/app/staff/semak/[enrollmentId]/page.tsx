import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { semak, tuntut } from "../../actions";

export const dynamic = "force-dynamic";
const nowMs = () => Date.now();

export default async function Page({ params, searchParams }: { params: Promise<{ enrollmentId: string }>; searchParams: Promise<{ ralat?: string }> }) {
  const { enrollmentId } = await params;
  const { ralat } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(enrollmentId)) notFound();
  const me = await requireRole(["reviewer", "approver", "admin"]);
  const db = adminClient();
  const { data: e } = await db.from("enrollments").select("id, stage, course_id, profiles!enrollments_user_id_fkey(full_name)").eq("id", enrollmentId).maybeSingle();
  if (!e) notFound();
  const { data: subs } = await db.from("submissions")
    .select("id, type, status, text_answer, file_key, comment, attempt_no, source, claimed_by, claimed_at, reviewer_id")
    .eq("enrollment_id", enrollmentId).in("type", ["subjective", "schematic"]).order("attempt_no", { ascending: false });
  const { data: course } = await db.from("courses").select("config").eq("id", e.course_id).single();
  const expiry = Number((course?.config as Record<string, unknown>).claim_expiry_days ?? 0) * 864e5;
  const latest = (t: string) => (subs ?? []).find((s) => s.type === t);
  const items = (["subjective", "schematic"] as const).map(latest).filter(Boolean) as NonNullable<ReturnType<typeof latest>>[];
  const pending = items.filter((s) => s.status === "pending");
  const live = (s: (typeof items)[number]) => !!s.claimed_by && !!s.claimed_at && nowMs() - new Date(s.claimed_at).getTime() < expiry;
  const heldByOther = pending.some((s) => live(s) && s.claimed_by !== me.id);
  const mine = pending.length > 0 && pending.every((s) => live(s) && s.claimed_by === me.id);
  const name = (e.profiles as unknown as { full_name: string } | null)?.full_name ?? "?";

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Link className="text-sm underline" href="/staff">&larr; Queue</Link>
      <h1 className="mt-2 text-2xl font-semibold">{name}</h1>
      <p className="text-sm">Stage: {e.stage}</p>
      {ralat && <p role="alert" className="mt-2 text-sm text-red-600">{ralat}</p>}
      {pending.length > 0 && !mine && (
        heldByOther ? <p className="mt-3 rounded border border-amber-500 p-3 text-sm">Item ini sedang dipegang penilai lain.</p> : (
          <form action={tuntut} className="mt-3"><input type="hidden" name="enrollment" value={enrollmentId} />
            <button className="rounded bg-black px-4 py-2 text-white">Tuntut untuk semak</button></form>))}
      {items.length === 0 && <p className="mt-4">Tiada penghantaran.</p>}
      {items.map((s) => (
        <section key={s.id} className="mt-4 rounded border p-3">
          <h2 className="font-medium">{s.type === "subjective" ? "Subjektif" : "Skematik"} · percubaan {s.attempt_no}{s.source === "manual_fasi" && " · (manual)"} · {s.status}</h2>
          {s.type === "subjective" && <p className="mt-2 whitespace-pre-wrap text-sm">{s.text_answer ?? "(tiada teks, rekod manual)"}</p>}
          {s.type === "schematic" && s.file_key && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/submissions/${s.id}/file`} alt="Skematik pelajar" className="mt-2 max-h-[28rem] w-auto border" />
          )}
          {s.comment && <p className="mt-2 text-sm">Komen: {s.comment}</p>}
          {s.status === "pending" && mine && (
            <form action={semak} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="submission" value={s.id} /><input type="hidden" name="enrollment" value={enrollmentId} />
              <textarea name="comment" rows={3} placeholder="Komen (wajib jika ditolak)" className="rounded border p-2 text-sm" />
              <div className="flex gap-2">
                <button name="decision" value="approved" className="rounded bg-green-700 px-3 py-1 text-white">Lulus</button>
                <button name="decision" value="rejected" className="rounded bg-red-700 px-3 py-1 text-white">Tolak</button>
              </div>
            </form>)}
        </section>))}
    </main>
  );
}
