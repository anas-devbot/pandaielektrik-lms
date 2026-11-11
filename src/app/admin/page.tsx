import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { CopyMsg } from "./op-form";

export const dynamic = "force-dynamic";
const nowMs = () => Date.now();
const age = (iso: string) => Math.floor((nowMs() - new Date(iso).getTime()) / 864e5);
const fmt = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));
const L = { tiada_aktiviti: "Tiada aktiviti", mcq_had_habis: "Ujian habis had percubaan", akses_30: "Akses tamat dalam 30 hari", akses_7: "Akses tamat dalam 7 hari" } as const;
// Templat mesej WhatsApp (DRAF, boleh diganti AHZ). Disalin dan dihantar manual: tiada API WhatsApp (CLAUDE.md #14).
const TPL: Record<keyof typeof L, string> = {
  tiada_aktiviti: "Salam {nama}, kami perasan anda belum aktif dalam kursus ini sejak {hari} hari. Ada apa-apa yang boleh kami bantu? Akses anda sehingga {tarikh}.",
  mcq_had_habis: "Salam {nama}, anda telah menggunakan had percubaan ujian akhir. Sila hubungi kami untuk bantuan lanjut.",
  akses_30: "Salam {nama}, akses kursus anda akan tamat pada {tarikh} ({hari} hari lagi). Sila siapkan pembelajaran anda sebelum itu.",
  akses_7: "Salam {nama}, akses kursus anda akan tamat pada {tarikh} ({hari} hari lagi). Hubungi kami jika anda perlukan bantuan.",
};

export default async function Page() {
  await requireRole(["admin"]);
  const db = adminClient();
  const [subj, prac, pracE, refunds, events, stuck] = await Promise.all([
    db.from("submissions").select("id, enrollment_id, type, created_at, claimed_by, enrollments!submissions_enrollment_id_fkey(profiles!enrollments_user_id_fkey(full_name))").eq("status", "pending").in("type", ["subjective", "schematic"]).order("created_at"),
    db.from("submissions").select("id, enrollment_id, type, created_at, enrollments!submissions_enrollment_id_fkey(profiles!enrollments_user_id_fkey(full_name))").eq("status", "pending").in("type", ["form", "video"]).order("created_at"),
    db.from("enrollments").select("id, energize_approved_at, profiles!enrollments_user_id_fkey(full_name)").eq("stage", "practical").is("practical_result", null),
    db.from("refund_requests").select("id, status, created_at").in("status", ["auto_failed", "letter_uploaded", "approved"]).order("created_at"),
    db.from("payment_events").select("id, transaction_id, order_number, outcome, amount, received_at").in("outcome", ["already_paid", "amount_mismatch", "unknown_order"]).order("received_at", { ascending: false }).limit(20),
    db.rpc("stuck_students"),
  ]);
  const ids = (pracE.data ?? []).map((x) => x.id);
  const { data: latest } = ids.length ? await db.from("submissions").select("enrollment_id, type, status, attempt_no").in("type", ["form", "video"]).in("enrollment_id", ids).order("attempt_no", { ascending: false }) : { data: [] };
  const lat = (e: string, t: string) => (latest ?? []).find((x) => x.enrollment_id === e && x.type === t);
  const waitApproval = (pracE.data ?? []).filter((x) => !x.energize_approved_at && lat(x.id, "form")?.status === "approved" && lat(x.id, "video")?.status === "approved");
  const waitResult = (pracE.data ?? []).filter((x) => !!x.energize_approved_at);
  const nm = (x: unknown) => ((x as { enrollments?: { profiles?: { full_name: string } | null } | null; profiles?: { full_name: string } | null }).enrollments?.profiles ?? (x as { profiles?: { full_name: string } | null }).profiles)?.full_name ?? "?";
  const stuckRows = (stuck.data ?? []) as { enrollment_id: string; full_name: string; email: string; phone: string | null; reason: keyof typeof L; detail: Record<string, number>; last_activity: string; access_ends_at: string }[];
  const msg = (r: (typeof stuckRows)[number]) => TPL[r.reason].replace("{nama}", r.full_name).replace("{hari}", String(r.detail.days ?? r.detail.days_left ?? "")).replace("{tarikh}", new Date(r.access_ends_at).toLocaleDateString("ms-MY"));
  const Row = ({ href, children }: { href: string; children: React.ReactNode }) => <li className="rounded border p-2 text-sm"><Link className="underline" href={href}>{children}</Link></li>;

  return (
    <main className="py-4">
      <h1 className="text-2xl font-semibold">Menunggu tindakan</h1>

      <section className="mt-4"><h2 className="font-medium">Semakan subjektif dan skematik ({subj.data?.length ?? 0})</h2>
        <ul className="mt-1 flex flex-col gap-1">{(subj.data ?? []).slice(0, 10).map((x) => <Row key={x.id} href={`/staff/semak/${x.enrollment_id}`}>{nm(x)} · {x.type === "subjective" ? "subjektif" : "skematik"} · menunggu {age(x.created_at)} hari{x.claimed_by ? " · dituntut" : ""}</Row>)}</ul>
        {(subj.data?.length ?? 0) === 0 && <p className="text-sm">Tiada.</p>}</section>

      <section className="mt-4"><h2 className="font-medium">Praktikal</h2>
        <ul className="mt-1 flex flex-col gap-1">
          {(prac.data ?? []).map((x) => <Row key={x.id} href={`/staff/praktikal/${x.enrollment_id}`}>{nm(x)} · {x.type === "form" ? "borang" : "video"} menunggu semakan ({age(x.created_at)} hari)</Row>)}
          {waitApproval.map((x) => <Row key={x.id} href={`/staff/praktikal/${x.id}`}>{nm(x)} · <b>menunggu kelulusan bekalan (approver)</b></Row>)}
          {waitResult.map((x) => <Row key={x.id} href={`/staff/praktikal/${x.id}`}>{nm(x)} · menunggu keputusan praktikal</Row>)}
        </ul>
        {(prac.data?.length ?? 0) + waitApproval.length + waitResult.length === 0 && <p className="text-sm">Tiada.</p>}</section>

      <section className="mt-4"><h2 className="font-medium">Refund ({refunds.data?.length ?? 0})</h2>
        {(refunds.data?.length ?? 0) > 0 ? <p className="text-sm"><Link className="underline" href="/admin/refund">{(refunds.data ?? []).filter((r) => r.status === "auto_failed").length} gagal semakan automatik · {(refunds.data ?? []).filter((r) => r.status === "letter_uploaded").length} menunggu keputusan · {(refunds.data ?? []).filter((r) => r.status === "approved").length} menunggu transfer bank</Link></p> : <p className="text-sm">Tiada.</p>}</section>

      <section className="mt-4"><h2 className="font-medium">Bayaran perlu semakan ({events.data?.length ?? 0})</h2>
        <p className="text-xs">Callback sah tetapi tidak membuka akses: bayaran berganda pada order yang sudah dibayar (pelanggan dicaj dua kali: perlu refund manual), amaun tidak sepadan, atau order tidak dikenali.</p>
        <ul className="mt-1 flex flex-col gap-1">{(events.data ?? []).map((e) => <li key={e.id} className="rounded border border-amber-500 p-2 text-sm">{e.outcome} · order {e.order_number} · {e.amount !== null ? `RM${(e.amount / 100).toFixed(2)}` : "-"} · {e.transaction_id} · {fmt(e.received_at)}</li>)}</ul>
        {(events.data?.length ?? 0) === 0 && <p className="text-sm">Tiada.</p>}</section>

      <section className="mt-4"><h2 className="font-medium">Pelajar tersangkut ({stuckRows.length})</h2>
        <p className="text-xs">Mesej disalin dan dihantar secara manual (tiada API WhatsApp). Templat ialah DRAF.</p>
        {(Object.keys(L) as (keyof typeof L)[]).map((reason) => { const rows = stuckRows.filter((r) => r.reason === reason); return rows.length === 0 ? null : (
          <div key={reason} className="mt-2"><h3 className="text-sm font-medium">{L[reason]} ({rows.length})</h3>
            <ul className="mt-1 flex flex-col gap-1">{rows.map((r) => (
              <li key={r.enrollment_id + reason} className="rounded border p-2 text-sm">
                <Link className="underline" href={`/admin/pelajar/${r.enrollment_id}`}>{r.full_name}</Link> · {r.email}{r.phone ? ` · ${r.phone}` : ""} ·{" "}
                {reason === "tiada_aktiviti" ? `${r.detail.days} hari tanpa aktiviti` : reason === "mcq_had_habis" ? `${r.detail.attempts}/${r.detail.limit} percubaan` : `${r.detail.days_left} hari baki akses`} · <CopyMsg text={msg(r)} />
              </li>))}</ul></div>); })}
        {stuckRows.length === 0 && <p className="text-sm">Tiada.</p>}</section>
    </main>
  );
}
