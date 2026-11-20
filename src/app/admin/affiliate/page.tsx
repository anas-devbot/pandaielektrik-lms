import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { decryptAkaun } from "@/lib/affiliate-bank";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const fmt = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));
const STATUS: Record<string, string> = { pending: "Menunggu semakan", approved: "Diluluskan", rejected: "Ditolak", suspended: "Digantung" };

// Senarai affiliate + butiran bank untuk admin cek penerima bayaran. Nombor akaun didekripsi di server, admin sahaja.
// Nilai akaun TIDAK dilog dan TIDAK masuk admin_actions. Tindakan luluskan/tolak/gantung dan tandakan dibayar: B8b.
export default async function Page() {
  await requireRole(["admin"]);
  const db = adminClient();
  const key = process.env.AFFILIATE_BANK_KEY;
  const { data: rows, error } = await db.from("affiliates")
    .select("id, code, status, is_test, rate_pct, created_at, bank_name, bank_account_name, bank_account_enc, bank_account_last4, bank_updated_at, profiles!affiliates_user_id_fkey(full_name)")
    .order("created_at", { ascending: false });

  const list = (rows ?? []).map((r) => {
    let akaun: string | null = null;
    if (r.bank_account_enc && key) { try { akaun = decryptAkaun(r.bank_account_enc, key); } catch { akaun = null; } }
    return { ...r, akaun, nama: (r.profiles as unknown as { full_name: string } | null)?.full_name ?? "—" };
  });

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Link className="text-sm underline" href="/admin">&larr; Admin</Link>
      <h1 className="mt-2 text-2xl font-semibold">Affiliate & akaun bank</h1>
      <p className="mt-1 text-sm">Gunakan butiran ini untuk transfer bank bayaran bulanan. Nombor akaun penuh hanya untuk admin. Jangan salin ke chat atau log.</p>
      {error && <p role="alert" className="mt-4 text-sm text-error">Gagal memuat senarai.</p>}
      {!key && <p role="alert" className="mt-4 text-sm text-error">AFFILIATE_BANK_KEY belum dikonfigurasi. Nombor akaun tidak dapat dipaparkan.</p>}
      {list.length === 0 && !error && <p className="mt-4">Belum ada affiliate.</p>}
      {list.map((r) => (
        <section key={r.id} className="mt-4 rounded-md border border-border bg-surface p-3 text-sm">
          <p className="font-semibold">{r.code} · {r.nama}{r.is_test ? " (akaun ujian)" : ""}</p>
          <p className="text-muted">{STATUS[r.status] ?? r.status} · kadar {r.rate_pct}% · daftar {fmt(r.created_at)}</p>
          {r.bank_name ? (
            <div className="mt-2">
              <p><span className="text-muted">Bank:</span> <strong>{r.bank_name}</strong></p>
              <p><span className="text-muted">Nama akaun:</span> {r.bank_account_name}</p>
              <p><span className="text-muted">No. akaun:</span> <span className="tabular-nums">{r.akaun ?? `•••• ${r.bank_account_last4}`}</span></p>
              <p className="text-xs text-muted">Dikemas kini {r.bank_updated_at ? fmt(r.bank_updated_at) : "—"}</p>
            </div>
          ) : (
            <p className="mt-2 text-warning">Belum ada akaun bank.</p>
          )}
        </section>
      ))}
    </main>
  );
}
