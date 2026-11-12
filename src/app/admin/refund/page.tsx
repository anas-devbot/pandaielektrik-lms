import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import TindakanForm from "./form";

export const dynamic = "force-dynamic";
const fmt = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));
const ORDER = ["letter_uploaded", "approved", "auto_failed", "letter_issued", "requested", "rejected", "refunded"];
const LABEL: Record<string, string> = { auto_failed: "Gagal semakan automatik", letter_issued: "Menunggu surat bertandatangan", letter_uploaded: "Surat diterima: menunggu keputusan", approved: "Diluluskan: menunggu transfer bank", rejected: "Ditolak", refunded: "Dipulangkan" };

export default async function Page() {
  await requireRole(["admin"]);
  const db = adminClient();
  const { data: reqs } = await db.from("refund_requests").select("id, status, reason, override_note, decision_note, refund_note, created_at, auto_check_snapshot, enrollment_id, enrollments!refund_requests_enrollment_id_fkey(order_id, profiles!enrollments_user_id_fkey(full_name))").order("created_at", { ascending: false });
  const orders = new Map<string, { order_number: string; amount: number }>();
  const ids = (reqs ?? []).map((r) => (r.enrollments as unknown as { order_id: string } | null)?.order_id).filter(Boolean) as string[];
  if (ids.length) for (const o of (await db.from("orders").select("id, order_number, amount").in("id", ids)).data ?? []) orders.set(o.id, o);
  const list = [...(reqs ?? [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Link className="text-sm underline" href="/admin">&larr; Admin</Link>
      <h1 className="mt-2 text-2xl font-semibold">Permohonan refund</h1>
      <p className="mt-1 text-sm">Refund dibuat MANUAL melalui transfer bank oleh AHZ, selepas Bayarcash membuat payout (Bayarcash tiada refund). Tandakan &quot;Telah dipulangkan&quot; hanya selepas transfer dibuat: ia menutup akses dan membatalkan sijil. Butiran akaun bank pelajar ada pada surat bertandatangan (tidak disimpan dalam sistem).</p>
      {list.length === 0 && <p className="mt-4">Tiada permohonan.</p>}
      {list.map((r) => {
        const en = r.enrollments as unknown as { order_id: string; profiles: { full_name: string } | null } | null;
        const o = en ? orders.get(en.order_id) : undefined; const s = r.auto_check_snapshot as Record<string, unknown> | null;
        return (
          <section key={r.id} className="mt-4 rounded-md border border-border bg-surface p-3">
            <h2 className="font-medium">{en?.profiles?.full_name ?? "?"} · {o?.order_number ?? "-"} · RM{o ? (o.amount / 100).toFixed(2) : "-"}</h2>
            <p className="text-sm"><b>{LABEL[r.status] ?? r.status}</b> · dimohon {fmt(r.created_at)}</p>
            {s && <p className="text-xs">Semakan: tempoh {String(s.window_ok)} · progres {String(s.progress_pct)}% (had &lt;{String(s.progress_max_pct)}%) · penghantaran {String(s.submissions)} · Ujian akhir {String(s.final_attempts)} · PDF {String(s.pdf_downloads)}{s.pdf_max !== null ? `/${String(s.pdf_max)}` : ""} → {s.eligible ? "LAYAK" : "TIDAK LAYAK"}</p>}
            {r.reason && <p className="text-sm">Sebab pelajar: {r.reason}</p>}
            {r.override_note && <p className="text-sm">Nota override: {r.override_note}</p>}
            {r.decision_note && <p className="text-sm">Nota keputusan: {r.decision_note}</p>}
            {r.refund_note && <p className="text-sm">Rujukan transfer bank: {r.refund_note}</p>}
            <p className="mt-1 text-sm">{r.status !== "auto_failed" && <><a className="underline" href={`/api/refund/${r.id}/surat`}>Surat refund</a> · </>}{["letter_uploaded", "approved", "refunded", "rejected"].includes(r.status) && <a className="underline" href={`/api/refund/${r.id}/fail`} target="_blank">Surat bertandatangan</a>}</p>
            {r.status === "auto_failed" && <TindakanForm request={r.id} ops={[{ op: "override", label: "Override (benarkan)" }, { op: "reject", label: "Tutup (tolak)", danger: true }]} />}
            {r.status === "letter_issued" && <TindakanForm request={r.id} ops={[{ op: "reject", label: "Tolak", danger: true }]} />}
            {r.status === "letter_uploaded" && <TindakanForm request={r.id} ops={[{ op: "approve", label: "Luluskan" }, { op: "reject", label: "Tolak", danger: true }]} />}
            {r.status === "approved" && <TindakanForm request={r.id} ops={[{ op: "refunded", label: "Telah dipulangkan (transfer bank)", danger: true }]} />}
          </section>
        );
      })}
    </main>
  );
}
