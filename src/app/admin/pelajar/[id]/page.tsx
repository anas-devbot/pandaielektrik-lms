import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { OpForm } from "../../op-form";

export const dynamic = "force-dynamic";
const fmt = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = adminClient();
  const { data: e } = await db.from("enrollments").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();
  const [{ data: prof }, au, { data: course }, { data: order }, { data: lessons }, { data: prog }, { data: attempts }, { data: subs }, { data: certs }, { data: refunds }, { data: log }] = await Promise.all([
    db.from("profiles").select("full_name, phone, role, privacy_accepted_at").eq("id", e.user_id).single(),
    db.auth.admin.getUserById(e.user_id),
    db.from("courses").select("title").eq("id", e.course_id).single(),
    e.order_id ? db.from("orders").select("order_number, amount, status, paid_at").eq("id", e.order_id).single() : Promise.resolve({ data: null }),
    db.from("lessons").select("id, duration_seconds").eq("course_id", e.course_id),
    db.from("lesson_progress").select("lesson_id, watched_seconds_unique, completed_at").eq("enrollment_id", id),
    db.from("quiz_attempts").select("type, attempt_no, score_pct, passed, submitted_at").eq("enrollment_id", id).order("started_at"),
    db.from("submissions").select("type, attempt_no, status, source, created_at").eq("enrollment_id", id).order("created_at"),
    db.from("certificates").select("id, type, cert_id, issued_at, revoked_at").eq("enrollment_id", id).order("issued_at"),
    db.from("refund_requests").select("id, status, created_at").eq("enrollment_id", id).order("created_at"),
    db.from("admin_actions").select("id, action, reason, created_at, actor_id").eq("enrollment_id", id).order("id", { ascending: false }).limit(30),
  ]);
  const total = (lessons ?? []).reduce((a, l) => a + l.duration_seconds, 0), watched = (prog ?? []).reduce((a, p) => a + p.watched_seconds_unique, 0);
  const done = (prog ?? []).filter((p) => p.completed_at).length;
  const { data: actors } = await db.from("profiles").select("id, full_name").in("id", [...new Set((log ?? []).map((l) => l.actor_id))]);
  const who = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
  const validCert = (certs ?? []).filter((c) => !c.revoked_at);

  return (
    <main className="py-4">
      <Link className="text-sm underline" href="/admin/pelajar">&larr; Pelajar</Link>
      <h1 className="mt-2 text-2xl font-semibold">{prof?.full_name}</h1>
      <p className="text-sm">{au.data.user?.email}{prof?.phone ? ` · ${prof.phone}` : ""} · privasi diterima {prof?.privacy_accepted_at ? fmt(prof.privacy_accepted_at) : "-"}</p>
      <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
        <dt>Kursus</dt><dd>{course?.title}</dd>
        <dt>Stage / trek</dt><dd>{e.stage} / {e.cert_track ?? "-"}</dd>
        <dt>Akses hingga</dt><dd>{fmt(e.access_ends_at)}{e.refunded_at ? " (REFUNDED)" : ""}</dd>
        <dt>Bayaran</dt><dd>{order ? `${order.order_number} · RM${(order.amount / 100).toFixed(2)} · ${order.status}${order.paid_at ? ` · ${fmt(order.paid_at)}` : ""}` : "tiada order (akses manual)"}</dd>
        <dt>Progres video</dt><dd>{done}/{lessons?.length ?? 0} video selesai · {total ? Math.round((100 * watched) / total) : 0}% saat unik</dd>
        <dt>Percubaan Ujian tambahan</dt><dd>{e.mcq_extra_attempts}</dd>
        <dt>Identiti disahkan</dt><dd>{e.identity_verified_at ? `${fmt(e.identity_verified_at)} (${e.identity_method})` : "belum"}</dd>
        <dt>Kebenaran bekalan</dt><dd>{e.energize_approved_at ? fmt(e.energize_approved_at) : "tiada"} · keputusan praktikal: {e.practical_result ?? "-"}</dd>
        <dt>Telegram</dt><dd>{e.telegram_invite_link ?? "-"}</dd>
      </dl>

      <section className="mt-4"><h2 className="font-medium">Percubaan Ujian, penghantaran, sijil, refund</h2>
        <ul className="mt-1 text-sm">
          {(attempts ?? []).map((a, i) => <li key={`a${i}`}>Ujian {a.type} #{a.attempt_no}: {a.submitted_at ? `${a.score_pct}% ${a.passed === null ? "" : a.passed ? "lulus" : "gagal"}` : "belum dihantar"}</li>)}
          {(subs ?? []).map((s, i) => <li key={`s${i}`}>{s.type} #{s.attempt_no}: {s.status}{s.source === "manual_fasi" ? " (manual)" : ""}</li>)}
          {(certs ?? []).map((c) => <li key={c.id}>Sijil {c.type} {c.cert_id}: {c.revoked_at ? "dibatalkan" : "sah"}</li>)}
          {(refunds ?? []).map((r) => <li key={r.id}>Refund: {r.status} ({fmt(r.created_at)}) · <Link className="underline" href="/admin/refund">urus</Link></li>)}
        </ul></section>

      {!e.refunded_at && (<>
        <h2 className="mt-6 text-lg font-medium">Tindakan (semua direkod dalam admin_actions)</h2>
        <section className="mt-2 rounded-md border border-border bg-surface p-3"><h3 className="font-medium">Lanjut tempoh akses</h3>
          <OpForm op="extend_access" hidden={{ enrollment: id }} fields={[{ name: "days", label: "Hari tambahan (1 hingga 365)", type: "number", required: true, defaultValue: 30 }, { name: "reason", label: "Sebab (wajib)", required: true }]} submit="Lanjutkan" /></section>
        <section className="mt-3 rounded-md border border-border bg-surface p-3"><h3 className="font-medium">Tambah percubaan ujian akhir</h3>
          <OpForm op="extra_attempts" hidden={{ enrollment: id }} fields={[{ name: "count", label: "Bilangan", type: "number", required: true, defaultValue: 1 }, { name: "reason", label: "Sebab (wajib)", required: true }]} submit="Tambah" /></section>
        <section className="mt-3 rounded-md border border-border bg-surface p-3"><h3 className="font-medium">Sahkan identiti</h3><p className="text-xs">Hanya diperlukan jika flag identiti dihidupkan untuk jenis sijil.</p>
          <OpForm op="verify_identity" hidden={{ enrollment: id }} fields={[{ name: "method", label: "Kaedah (cth. semak kad pengenalan di sesi)", required: true }, { name: "reason", label: "Sebab (wajib)", required: true }]} submit="Sahkan" /></section>
        <section className="mt-3 rounded-md border border-border bg-surface p-3"><h3 className="font-medium">Pautan jemputan Telegram</h3>
          <OpForm op="telegram_link" hidden={{ enrollment: id }} fields={[{ name: "link", label: "https://t.me/+...", required: true }]} submit="Tetapkan" /></section>
        {validCert.map((c) => <section key={c.id} className="mt-3 rounded-md border border-border bg-surface p-3"><h3 className="font-medium">Batalkan sijil {c.cert_id}</h3><p className="text-xs">Pelajar boleh mengeluarkan semula dengan nama betul.</p>
          <OpForm op="revoke_cert" hidden={{ certificate: c.id, back: id }} fields={[{ name: "reason", label: "Sebab (wajib)", required: true }]} submit="Batalkan sijil" danger /></section>)}
      </>)}

      <section className="mt-6 rounded-md border border-border bg-surface p-3"><h3 className="font-medium">Tukar nombor telefon</h3>
        <p className="text-xs">Untuk pelajar yang tukar nombor atau belum ada telefon. Nombor tidak disimpan dalam log tindakan.</p>
        <OpForm op="edit_phone" hidden={{ enrollment: id, user: e.user_id }} fields={[{ name: "phone", label: "Nombor telefon (cth. 0123456789)", required: true, defaultValue: prof?.phone ?? "" }, { name: "reason", label: "Sebab (wajib)", required: true }]} submit="Kemas kini telefon" /></section>

      <h2 className="mt-6 font-medium">Log tindakan</h2>
      <ul className="mt-1 text-sm">{(log ?? []).map((l) => <li key={l.id}>{fmt(l.created_at)} · {l.action} · {who.get(l.actor_id) ?? "?"} · {l.reason}</li>)}</ul>
      {(log?.length ?? 0) === 0 && <p className="text-sm">Tiada tindakan.</p>}
    </main>
  );
}
