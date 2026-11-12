import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { PautanTelegram, RekodManual, TambahPercubaan } from "../forms";
import { OpForm } from "../op-form";
import { buttonClass } from "@/components/button";

export const dynamic = "force-dynamic";
const d = (iso: string) => new Intl.DateTimeFormat("ms-MY", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole(["admin"]);
  const { q = "" } = await searchParams; const term = q.trim().slice(0, 100);
  const db = adminClient();
  let uids: string[] | null = null;
  if (term.includes("@")) { const { data } = await db.rpc("find_user_by_email", { p_email: term }); uids = data ? [data as string] : []; }
  else if (term) uids = ((await db.from("profiles").select("id").ilike("full_name", `%${term.replace(/[%_]/g, "")}%`).limit(50)).data ?? []).map((p) => p.id);
  let query = db.from("enrollments").select("id, user_id, stage, cert_track, access_ends_at, refunded_at, created_at, profiles!enrollments_user_id_fkey(full_name)").order("created_at", { ascending: false }).limit(40);
  if (uids) query = query.in("user_id", uids.length ? uids : ["00000000-0000-0000-0000-000000000000"]);
  const { data: rows } = await query;
  return (
    <main className="py-4">
      <h1 className="text-2xl font-semibold">Pelajar &amp; enrollment</h1>
      <form className="mt-3 flex gap-2"><input name="q" defaultValue={term} placeholder="Emel penuh atau nama" className="flex-1 rounded-md border border-border bg-surface p-2 text-sm" aria-label="Cari pelajar" /><button className={buttonClass("primary")}>Cari</button></form>
      <table className="mt-3 w-full text-sm"><thead><tr className="text-left"><th>Nama</th><th>Stage</th><th>Trek</th><th>Akses hingga</th></tr></thead>
        <tbody>{(rows ?? []).map((r) => <tr key={r.id} className="border-t"><td><Link className="underline" href={`/admin/pelajar/${r.id}`}>{(r.profiles as unknown as { full_name: string } | null)?.full_name ?? "?"}</Link></td><td>{r.stage}</td><td>{r.cert_track ?? "-"}</td><td>{r.refunded_at ? "refunded" : d(r.access_ends_at)}</td></tr>)}</tbody></table>
      {(rows?.length ?? 0) === 0 && <p className="mt-3">Tiada hasil.</p>}

      <h2 className="mt-8 text-lg font-medium">Alat admin (berdasarkan emel)</h2>
      <section className="mt-2 rounded-md border border-border bg-surface p-3"><h3 className="font-medium">Beri akses manual (tanpa bayaran)</h3>
        <p className="text-sm">Mencipta enrollment tanpa order, dengan sebab wajib.</p>
        <OpForm op="grant_manual" fields={[{ name: "email", label: "Emel pelajar", type: "email", required: true }, { name: "reason", label: "Sebab (wajib)", required: true }]} submit="Beri akses" /></section>
      <section className="mt-4 rounded-md border border-border bg-surface p-3"><h3 className="font-medium">Tambah percubaan ujian akhir</h3><TambahPercubaan /></section>
      <section className="mt-4 rounded-md border border-border bg-surface p-3"><h3 className="font-medium">Rekod penghantaran manual (sesi bantuan fasilitator)</h3><RekodManual /></section>
      <section className="mt-4 rounded-md border border-border bg-surface p-3"><h3 className="font-medium">Pautan jemputan Telegram</h3><PautanTelegram /></section>
    </main>
  );
}
