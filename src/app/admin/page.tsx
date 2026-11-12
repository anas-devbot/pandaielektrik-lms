import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { CopyMsg } from "./op-form";
import { SetNavCounts } from "./nav";
import { Tile, Box, Person, initials } from "./ui";

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
  const msg = (r: (typeof stuckRows)[number]) => TPL[r.reason].replace("{nama}", r.full_name).replace("{hari}", String(r.detail.days ?? r.detail.days_left ?? "")).replace("{tarikh}", new Intl.DateTimeFormat("ms-MY", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(r.access_ends_at)));
  const nSubj = subj.data?.length ?? 0, nEvents = events.data?.length ?? 0, nRefund = refunds.data?.length ?? 0;
  const nPrac = (prac.data?.length ?? 0) + waitResult.length;
  const total = nSubj + nEvents + nRefund + nPrac + waitApproval.length;
  return (
    <main>
      <SetNavCounts counts={{ "/admin": total, "/admin/queue": nSubj + (prac.data?.length ?? 0), "/admin/bekalan": waitApproval.length, "/admin/refund": nRefund }} />
      <h1 className="font-serif text-2xl font-semibold">Menunggu tindakan</h1>
      <p className="mt-0.5 text-sm text-muted">{total === 0 ? "Tiada perkara menunggu anda." : `${total} perkara menunggu anda.`}</p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <Tile n={nEvents} label="Bayaran perlu semakan" tone="alert" />
        <Tile n={waitApproval.length} label="Kebenaran bekalan" tone="gold" />
        <Tile n={nSubj} label="Semakan subjektif / skematik" />
        <Tile n={nRefund} label="Refund" />
        <Tile n={nPrac} label="Praktikal menunggu" />
      </div>

      <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-5">
        <div>
          <Box title="Bayaran perlu semakan" n={nEvents} warn>
            <p className="px-3.5 pt-2 text-xs text-muted">Callback sah tetapi tidak membuka akses: bayaran berganda pada order yang sudah dibayar (pelanggan dicaj dua kali: perlu refund manual), amaun tidak sepadan, atau order tidak dikenali.</p>
            {(events.data ?? []).map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-border px-3.5 py-2.5 text-sm last:border-b-0">
                <span className="rounded-full border border-warning px-2 py-0.5 text-xs font-semibold text-warning">{e.outcome}</span>
                <span className="font-semibold">order {e.order_number}</span>
                <span className="text-xs text-muted">{e.amount !== null ? `RM${(e.amount / 100).toFixed(2)}` : "-"} · {e.transaction_id} · {fmt(e.received_at)}</span>
              </div>
            ))}
          </Box>

          <Box title="Praktikal" n={nPrac}>
            {(prac.data ?? []).map((x) => <Person key={x.id} name={nm(x)} sub={`${x.type === "form" ? "borang" : "video"} menunggu semakan`} right={`${age(x.created_at)} hari`} href={`/staff/praktikal/${x.enrollment_id}`} action="Semak" />)}
            {waitApproval.map((x) => <Person key={x.id} name={nm(x)} sub={<b>menunggu kelulusan bekalan (approver)</b>} href={`/staff/praktikal/${x.id}`} />)}
            {waitResult.map((x) => <Person key={x.id} name={nm(x)} sub="menunggu keputusan praktikal" href={`/staff/praktikal/${x.id}`} />)}
          </Box>

          <Box title="Semakan subjektif dan skematik" n={nSubj}>
            {(subj.data ?? []).slice(0, 10).map((x) => <Person key={x.id} name={nm(x)} sub={<>{x.type === "subjective" ? "subjektif" : "skematik"}{x.claimed_by ? <span className="ml-2 rounded-full border border-gold px-2 py-0.5 text-gold-text">dituntut</span> : null}</>} right={`menunggu ${age(x.created_at)} hari`} href={`/staff/semak/${x.enrollment_id}`} action="Semak" />)}
          </Box>

          <Box title="Refund" n={nRefund}>
            <p className="px-3.5 py-3 text-sm"><Link className="font-semibold text-gold-text underline underline-offset-4" href="/admin/refund">{(refunds.data ?? []).filter((r) => r.status === "auto_failed").length} gagal semakan automatik · {(refunds.data ?? []).filter((r) => r.status === "letter_uploaded").length} menunggu keputusan · {(refunds.data ?? []).filter((r) => r.status === "approved").length} menunggu transfer bank</Link></p>
          </Box>
        </div>

        <div>
          <Box title="Pelajar tersangkut" n={stuckRows.length}>
            <p className="px-3.5 pt-2 text-xs text-muted">Mesej disalin dan dihantar secara manual (tiada API WhatsApp). Templat ialah DRAF.</p>
            {(Object.keys(L) as (keyof typeof L)[]).map((reason) => { const rows = stuckRows.filter((r) => r.reason === reason); return rows.length === 0 ? null : (
              <div key={reason}>
                <h3 className="mt-2 border-y border-border bg-paper px-3.5 py-1.5 text-xs font-bold text-muted">{L[reason]} ({rows.length})</h3>
                {rows.map((r) => (
                  <div key={r.enrollment_id + reason} className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 text-sm last:border-b-0">
                    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-xs font-bold">{initials(r.full_name)}</span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <Link className="font-semibold underline underline-offset-4" href={`/admin/pelajar/${r.enrollment_id}`}>{r.full_name}</Link>
                      <p className="break-words text-xs text-muted">{r.email}{r.phone ? ` · ${r.phone}` : ""} · {reason === "tiada_aktiviti" ? `${r.detail.days} hari tanpa aktiviti` : reason === "mcq_had_habis" ? `${r.detail.attempts}/${r.detail.limit} percubaan` : `${r.detail.days_left} hari baki akses`}</p>
                    </div>
                    <span className="shrink-0 font-semibold text-gold-text"><CopyMsg text={msg(r)} /></span>
                  </div>
                ))}
              </div>); })}
          </Box>
        </div>
      </div>
    </main>
  );
}
