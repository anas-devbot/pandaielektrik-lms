import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatRM } from "@/lib/affiliate";
import { createClient } from "@/lib/supabase/server";
import { buttonClass } from "@/components/button";
import { BankForm } from "../bank-form";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeZone: "Asia/Kuala_Lumpur" });
const LABEL: Record<string, string> = { pending: "Menunggu kelulusan", approved: "Diluluskan", paid: "Dibayar", reversed: "Dibatalkan (refund)" };

// Dashboard affiliate: HANYA data sendiri (RLS). Tiada nama, emel atau butiran pembeli dibaca atau dipaparkan.
export default async function Page() {
  await requireRole(["student"]);
  const supabase = await createClient();
  // Lajur bank: nama bank, nama akaun, 4 digit akhir sahaja (ciphertext tidak boleh dibaca klien, lihat migration B8a)
  const { data: aff } = await supabase.from("affiliates").select("code, status, rate_pct, is_test, bank_name, bank_account_name, bank_account_last4").maybeSingle();

  if (!aff) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="font-serif text-3xl font-semibold">Dashboard affiliate</h1>
        <p className="mt-2">Anda belum mendaftar sebagai affiliate.</p>
        <Link href="/affiliate" className={buttonClass("primary", "mt-4")}>Lihat program affiliate</Link>
      </main>
    );
  }

  if (aff.status !== "approved") {
    const msg = aff.status === "pending" ? "Permohonan anda menunggu semakan AHZ Teknik." :
      aff.status === "rejected" ? "Permohonan affiliate anda tidak diluluskan." :
      "Akaun affiliate anda digantung buat sementara. Hubungi AHZ Teknik untuk maklumat lanjut.";
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="font-serif text-3xl font-semibold">Dashboard affiliate</h1>
        <p className="mt-2" role="status">{msg}</p>
      </main>
    );
  }

  const [{ data: comm }, { data: payouts }, { data: adj }] = await Promise.all([
    supabase.from("affiliate_commissions").select("amount_sen, status, created_at, approved_at, is_test").order("created_at", { ascending: false }),
    supabase.from("payouts").select("period, total_sen, status, paid_at").order("period", { ascending: false }),
    supabase.from("affiliate_adjustments").select("amount_sen").is("carried_to_payout_id", null),
  ]);

  const rows = comm ?? [];
  const sum = (st: string) => rows.filter((r) => r.status === st).reduce((t, r) => t + r.amount_sen, 0);
  const jualan = rows.filter((r) => r.status !== "reversed").length;
  const pelarasan = (adj ?? []).reduce((t, r) => t + r.amount_sen, 0);
  const pautan = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/?ref=${aff.code}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="font-serif text-3xl font-semibold">Dashboard affiliate</h1>
      {aff.is_test && <p className="mt-2 text-sm text-info">Akaun ujian. Komisen tidak masuk bayaran sebenar.</p>}

      <section className="mt-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Pautan rujukan anda</h2>
        <p className="mt-1 text-sm text-muted">Kod: <span className="font-semibold text-ink">{aff.code}</span> · Kadar {aff.rate_pct}%</p>
        <input readOnly value={pautan} aria-label="Pautan rujukan"
          className="mt-2 block w-full rounded-md border border-border bg-paper px-3 py-3 text-base" />
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Akaun bank penerima bayaran</h2>
        {aff.bank_name ? (
          <div className="mt-2 text-sm">
            <p><span className="text-muted">Bank:</span> <strong>{aff.bank_name}</strong></p>
            <p><span className="text-muted">Nama akaun:</span> {aff.bank_account_name}</p>
            <p><span className="text-muted">No. akaun:</span> <span className="tabular-nums">•••• {aff.bank_account_last4}</span></p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-warning">Belum ada akaun bank. Isi di bawah supaya AHZ boleh bayar komisen anda.</p>
        )}
        <BankForm current={!!aff.bank_name} />
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Stat label="Pendaftaran berbayar" value={String(jualan)} />
        <Stat label="Menunggu kelulusan" value={formatRM(sum("pending"))} />
        <Stat label="Diluluskan, belum dibayar" value={formatRM(sum("approved"))} />
        <Stat label="Sudah dibayar" value={formatRM(sum("paid"))} />
        <Stat label="Pelarasan belum dibawa" value={formatRM(pelarasan)} />
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Bayaran</h2>
        {(payouts ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted">Belum ada bayaran. Komisen dikira hujung bulan.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {(payouts ?? []).map((p) => (
              <li key={p.period} className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
                <span>
                  <span className="block font-semibold">{p.period}</span>
                  <span className="text-sm text-muted">{p.status === "paid" && p.paid_at ? `Dibayar ${fmt.format(new Date(p.paid_at))}` : "Dijadual untuk bayaran bulan berikut"}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatRM(p.total_sen)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Komisen</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Belum ada komisen. Kongsi pautan anda untuk mula.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3 text-sm">
                <span>
                  <span className="block">{LABEL[r.status] ?? r.status}{r.is_test ? " (ujian)" : ""}</span>
                  <span className="text-muted">{fmt.format(new Date(r.created_at))}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatRM(r.amount_sen)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
