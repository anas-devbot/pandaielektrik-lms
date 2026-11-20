import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatRM } from "@/lib/affiliate";
import { decryptAkaun } from "@/lib/affiliate-bank";
import { adminClient } from "@/lib/supabase/admin";
import { PayForm, StatusForm } from "./ops-form";

export const dynamic = "force-dynamic";
const fmt = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));
const STATUS: Record<string, string> = { pending: "Menunggu semakan", approved: "Diluluskan", rejected: "Ditolak", suspended: "Digantung" };
const KOMISEN: Record<string, string> = { pending: "Menunggu", approved: "Diluluskan", paid: "Dibayar", reversed: "Dibatalkan" };

// Modul affiliate admin: status, bank, payout dan komisen. Dua mod: akaun sebenar (default) atau akaun ujian (?akaun=ujian).
// Nombor akaun didekripsi di server, admin sahaja. Nilai akaun TIDAK dilog.
export default async function Page({ searchParams }: { searchParams: Promise<{ akaun?: string }> }) {
  await requireRole(["admin"]);
  const { akaun } = await searchParams;
  const ujian = akaun === "ujian";
  const db = adminClient();
  const key = process.env.AFFILIATE_BANK_KEY;

  const [{ data: affRows, error: e1 }, { data: payRows }, { data: comRows }] = await Promise.all([
    db.from("affiliates")
      .select("id, code, status, is_test, rate_pct, created_at, bank_name, bank_account_name, bank_account_enc, bank_account_last4, bank_updated_at, profiles!affiliates_user_id_fkey(full_name)")
      .eq("is_test", ujian).order("created_at", { ascending: false }),
    db.from("payouts").select("id, period, total_sen, status, paid_at, payment_ref, affiliates!inner(code, is_test)")
      .eq("affiliates.is_test", ujian).order("period", { ascending: false }).order("created_at", { ascending: false }).limit(200),
    db.from("affiliate_commissions").select("amount_sen, status, created_at, approved_at, is_test, affiliates(code)")
      .eq("is_test", ujian).order("created_at", { ascending: false }).limit(100),
  ]);

  const affs = (affRows ?? []).map((r) => {
    let no: string | null = null;
    if (r.bank_account_enc && key) { try { no = decryptAkaun(r.bank_account_enc, key); } catch { no = null; } }
    return { ...r, no, nama: (r.profiles as unknown as { full_name: string } | null)?.full_name ?? "—" };
  });
  const menunggu = affs.filter((a) => a.status === "pending").length;
  const dueSum = (payRows ?? []).filter((p) => p.status === "due").reduce((t, p) => t + p.total_sen, 0);

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Link className="text-sm underline" href="/admin">&larr; Admin</Link>
      <h1 className="mt-2 text-2xl font-semibold">Affiliate</h1>
      <p className="mt-1 text-sm">
        Mod: <strong>{ujian ? "akaun ujian" : "akaun sebenar"}</strong> ·{" "}
        {ujian ? <Link className="underline" href="/admin/affiliate">lihat akaun sebenar</Link> : <Link className="underline" href="/admin/affiliate?akaun=ujian">lihat akaun ujian</Link>}
      </p>
      {e1 && <p role="alert" className="mt-4 text-sm text-error">Gagal memuat senarai affiliate.</p>}
      {!key && <p role="alert" className="mt-4 text-sm text-error">AFFILIATE_BANK_KEY belum dikonfigurasi. Nombor akaun tidak dapat dipaparkan.</p>}

      <h2 className="mt-8 text-xl font-semibold">Menunggu tindakan</h2>
      <p className="mt-1 text-sm">Permohonan affiliate menunggu semakan: {menunggu}. Payout menunggu bayaran: {(payRows ?? []).filter((p) => p.status === "due").length} ({formatRM(dueSum)}).</p>

      <h2 className="mt-8 text-xl font-semibold">Affiliate & akaun bank</h2>
      {affs.length === 0 && <p className="mt-2 text-sm">Tiada affiliate dalam mod ini.</p>}
      {affs.map((r) => (
        <section key={r.id} className="mt-4 rounded-md border border-border bg-surface p-3 text-sm">
          <p className="font-semibold">{r.code} · {r.nama}</p>
          <p className="text-muted">{STATUS[r.status] ?? r.status} · kadar {r.rate_pct}% · daftar {fmt(r.created_at)}</p>
          {r.bank_name ? (
            <div className="mt-2">
              <p><span className="text-muted">Bank:</span> <strong>{r.bank_name}</strong></p>
              <p><span className="text-muted">Nama akaun:</span> {r.bank_account_name}</p>
              <p><span className="text-muted">No. akaun:</span> <span className="tabular-nums">{r.no ?? `•••• ${r.bank_account_last4}`}</span></p>
              <p className="text-xs text-muted">Dikemas kini {r.bank_updated_at ? fmt(r.bank_updated_at) : "—"}</p>
            </div>
          ) : (
            <p className="mt-2 text-warning">Belum ada akaun bank.</p>
          )}
          {(r.status === "pending" || r.status === "approved" || r.status === "suspended") && <StatusForm affiliate={r.id} status={r.status} />}
        </section>
      ))}

      <h2 className="mt-8 text-xl font-semibold">Payout mengikut bulan</h2>
      <p className="mt-1 text-sm">Transfer bank dibuat AHZ secara manual. Tandakan sudah dibayar selepas transfer, dengan rujukan transfer.</p>
      {(payRows ?? []).length === 0 && <p className="mt-2 text-sm">Belum ada payout. Tutup bulan berjalan melalui cron.</p>}
      {(payRows ?? []).map((p) => {
        const aff = p.affiliates as unknown as { code: string } | null;
        return (
          <section key={p.id} className="mt-3 rounded-md border border-border bg-surface p-3 text-sm">
            <p className="font-semibold">{p.period} · {aff?.code ?? "—"} · <span className="tabular-nums">{formatRM(p.total_sen)}</span></p>
            {p.status === "paid" ? (
              <p className="text-success">Dibayar{p.paid_at ? ` ${fmt(p.paid_at)}` : ""} · rujukan {p.payment_ref}</p>
            ) : (
              <>
                <p className="text-muted">Menunggu bayaran</p>
                {p.total_sen > 0 ? <PayForm payout={p.id} /> : <p className="mt-1 text-warning">Jumlah tidak positif. Tidak boleh dibayar.</p>}
              </>
            )}
          </section>
        );
      })}

      <h2 className="mt-8 text-xl font-semibold">Komisen terkini</h2>
      <p className="mt-1 text-sm">100 terkini. Tiada butiran pembeli dipaparkan.</p>
      {(comRows ?? []).length === 0 && <p className="mt-2 text-sm">Tiada komisen dalam mod ini.</p>}
      <ul className="mt-2 flex flex-col gap-2">
        {(comRows ?? []).map((c, i) => {
          const aff = c.affiliates as unknown as { code: string } | null;
          return (
            <li key={i} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm">
              <span>{aff?.code ?? "—"} · {KOMISEN[c.status] ?? c.status}<span className="block text-xs text-muted">{fmt(c.created_at)}</span></span>
              <span className="tabular-nums font-semibold">{formatRM(c.amount_sen)}</span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
