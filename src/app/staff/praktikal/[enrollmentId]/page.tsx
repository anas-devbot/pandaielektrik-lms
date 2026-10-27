import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { luluskanBekalan, rekodKeputusan, semakPraktikal, tuntutPraktikal } from "../../praktikal-actions";

export const dynamic = "force-dynamic";
const nowMs = () => Date.now();
const fmt = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));

export default async function Page({ params, searchParams }: { params: Promise<{ enrollmentId: string }>; searchParams: Promise<{ ralat?: string }> }) {
  const { enrollmentId } = await params;
  const { ralat } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(enrollmentId)) notFound();
  const me = await requireRole(["reviewer", "approver", "admin"]);
  const db = adminClient();
  const { data: e } = await db.from("enrollments").select("id, stage, cert_track, course_id, energize_approved_at, energize_approved_by, practical_result, practical_comment, telegram_invite_link, profiles!enrollments_user_id_fkey(full_name)").eq("id", enrollmentId).maybeSingle();
  if (!e) notFound();
  const { data: subs } = await db.from("submissions").select("id, type, status, comment, attempt_no, external_ref, declared_at, claimed_by, claimed_at").eq("enrollment_id", enrollmentId).in("type", ["form", "video"]).order("attempt_no", { ascending: false });
  const { data: course } = await db.from("courses").select("config").eq("id", e.course_id).single();
  const cfg = course?.config as Record<string, unknown>;
  const expiry = Number(cfg.claim_expiry_days ?? 0) * 864e5;
  const form = (subs ?? []).find((s) => s.type === "form"), video = (subs ?? []).find((s) => s.type === "video");
  const items = [form, video].filter(Boolean) as NonNullable<typeof form>[];
  const pending = items.filter((s) => s.status === "pending");
  const live = (s: (typeof items)[number]) => !!s.claimed_by && !!s.claimed_at && nowMs() - new Date(s.claimed_at).getTime() < expiry;
  const heldByOther = pending.some((s) => live(s) && s.claimed_by !== me.id);
  const mine = pending.length > 0 && pending.every((s) => live(s) && s.claimed_by === me.id);
  const name = (e.profiles as unknown as { full_name: string } | null)?.full_name ?? "?";
  const bothOk = form?.status === "approved" && video?.status === "approved";
  const approved = !!e.energize_approved_at;
  const guidance = String(cfg.energize_guidance_text ?? "");
  const { data: log } = await db.from("admin_actions").select("id, action, reason, created_at, detail").eq("enrollment_id", enrollmentId).in("action", ["energize_approval", "energize_cancelled", "practical_result"]).order("id", { ascending: false }).limit(10);

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Link className="text-sm underline" href="/staff">&larr; Queue</Link>
      <h1 className="mt-2 text-2xl font-semibold">Praktikal: {name}</h1>
      <p className="text-sm">Stage: {e.stage} · Trek: {e.cert_track ?? "-"} · Keputusan: {e.practical_result ?? "-"}</p>
      {ralat && <p role="alert" className="mt-2 text-sm text-red-600">{ralat}</p>}

      {pending.length > 0 && !mine && (heldByOther ? <p className="mt-3 rounded border border-amber-500 p-3 text-sm">Item ini sedang dipegang penilai lain.</p> : (
        <form action={tuntutPraktikal} className="mt-3"><input type="hidden" name="enrollment" value={enrollmentId} /><button className="rounded bg-black px-4 py-2 text-white">Tuntut untuk semak</button></form>))}

      {items.map((s) => (
        <section key={s.id} className="mt-4 rounded border p-3">
          <h2 className="font-medium">{s.type === "form" ? "Borang bertandatangan" : "Deklarasi video (Telegram)"} · percubaan {s.attempt_no} · {s.status}</h2>
          {s.type === "form" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/submissions/${s.id}/file`} alt="Borang pelajar" className="mt-2 max-h-[26rem] w-auto border" />
          )}
          {s.type === "video" && <p className="mt-2 text-sm">Rujukan pelajar: <b>{s.external_ref}</b> · diisytihar {s.declared_at ? fmt(s.declared_at) : "-"}. Video dilihat di Telegram group (di luar sistem).</p>}
          {s.comment && <p className="mt-1 text-sm">Komen: {s.comment}</p>}
          {s.status === "pending" && mine && (
            <form action={semakPraktikal} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="submission" value={s.id} /><input type="hidden" name="enrollment" value={enrollmentId} />
              <textarea name="comment" rows={2} placeholder="Komen (wajib jika ditolak)" className="rounded border p-2 text-sm" />
              <div className="flex gap-2">
                <button name="decision" value="approved" className="rounded bg-green-700 px-3 py-1 text-white">Terima</button>
                <button name="decision" value="rejected" className="rounded bg-red-700 px-3 py-1 text-white">Tolak</button>
              </div>
            </form>)}
        </section>))}
      {items.length === 0 && <p className="mt-4">Tiada penghantaran.</p>}

      {e.stage === "practical" && e.practical_result !== "lulus" && (
        <section className="mt-6 rounded border-2 border-red-600 p-3">
          <h2 className="font-semibold">Kebenaran memasukkan bekalan</h2>
          {approved ? (
            <p className="mt-1 text-sm">Direkodkan pada {fmt(e.energize_approved_at!)}. Terikat pada deklarasi video semasa; hantar semula video atau borang membatalkannya secara automatik.</p>
          ) : bothOk && video ? (
            me.role === "approver" ? (
              <form action={luluskanBekalan} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="enrollment" value={enrollmentId} /><input type="hidden" name="video" value={video.id} />
                <p className="text-sm">Teks panduan keselamatan AHZ yang akan direkodkan bersama kelulusan:</p>
                <pre className="whitespace-pre-wrap rounded border bg-zinc-50 p-2 text-sm text-black">{guidance || "(BELUM DITETAPKAN: kelulusan akan ditolak)"}</pre>
                <label className="flex items-start gap-2 text-sm"><input name="confirm" type="checkbox" required className="mt-1" />
                  <span>Saya telah menyemak borang dan video di Telegram, dan meluluskan ini secara manual. Sistem tidak menjana kebenaran ini.</span></label>
                <button className="rounded bg-red-700 p-2 text-white">Luluskan kebenaran memasukkan bekalan</button>
              </form>
            ) : <p className="mt-1 text-sm">Borang dan video telah diterima. Hanya <b>approver</b> AHZ boleh meluluskan kebenaran bekalan.</p>
          ) : <p className="mt-1 text-sm">Belum boleh diluluskan: borang dan video terkini mesti disemak dan diterima dahulu.</p>}
        </section>
      )}

      {approved && e.stage === "practical" && e.practical_result !== "lulus" && me.role !== "admin" && (
        <section className="mt-4 rounded border p-3">
          <h2 className="font-medium">Rekod keputusan praktikal (selepas bekalan dimasukkan di luar sistem)</h2>
          <form action={rekodKeputusan} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="enrollment" value={enrollmentId} />
            <textarea name="comment" rows={2} placeholder="Komen (wajib jika belum lulus)" className="rounded border p-2 text-sm" />
            <div className="flex gap-2"><button name="result" value="lulus" className="rounded bg-green-700 px-3 py-1 text-white">Lulus</button>
              <button name="result" value="belum" className="rounded bg-red-700 px-3 py-1 text-white">Belum</button></div>
          </form>
        </section>
      )}

      {log && log.length > 0 && (
        <section className="mt-6"><h2 className="font-medium">Log tindakan</h2>
          <ul className="mt-1 text-sm">{log.map((l) => <li key={l.id}>{fmt(l.created_at)} · {l.action} · {l.reason}</li>)}</ul></section>)}
    </main>
  );
}
