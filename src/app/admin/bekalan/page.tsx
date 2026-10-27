import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const fmt = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));

// BACA SAHAJA. Kebenaran bekalan hanya dibuat approver di /staff/praktikal (CLAUDE.md #9): admin tidak boleh meluluskan.
export default async function Page() {
  await requireRole(["admin"]);
  const db = adminClient();
  const { data: enr } = await db.from("enrollments").select("id, stage, energize_approved_at, energize_approved_by, practical_result, practical_result_at, profiles!enrollments_user_id_fkey(full_name)").eq("cert_track", "theory_practical").order("created_at", { ascending: false });
  const { data: staff } = await db.from("profiles").select("id, full_name").in("role", ["approver", "admin", "reviewer"]);
  const who = new Map((staff ?? []).map((x) => [x.id, x.full_name]));
  const { data: log } = await db.from("admin_actions").select("id, action, reason, created_at, enrollment_id, actor_id, detail").in("action", ["energize_approval", "energize_cancelled", "practical_result"]).order("id", { ascending: false }).limit(40);
  const state = (e: NonNullable<typeof enr>[number]) => e.practical_result === "lulus" ? "Praktikal LULUS" : e.energize_approved_at ? `Kebenaran direkod ${fmt(e.energize_approved_at)} oleh ${who.get(e.energize_approved_by ?? "") ?? "?"}` : e.practical_result === "belum" ? "Keputusan: belum (hantar semula)" : "Tiada kebenaran: pelajar diminta JANGAN masukkan bekalan";
  return (
    <main className="py-4">
      <h1 className="text-2xl font-semibold">Kebenaran bekalan</h1>
      <p className="text-sm">Paparan sahaja. Hanya <b>approver</b> AHZ boleh meluluskan di halaman praktikal staf. Hantar semula borang atau video membatalkan kelulusan secara automatik.</p>
      <ul className="mt-3 flex flex-col gap-2">{(enr ?? []).map((e) => <li key={e.id} className="rounded border p-2 text-sm"><Link className="underline" href={`/admin/pelajar/${e.id}`}>{(e.profiles as unknown as { full_name: string } | null)?.full_name ?? "?"}</Link> · {e.stage} · {state(e)} · <Link className="underline" href={`/staff/praktikal/${e.id}`}>halaman praktikal</Link></li>)}</ul>
      {(enr?.length ?? 0) === 0 && <p className="mt-3">Tiada pelajar trek praktikal.</p>}
      <h2 className="mt-6 font-medium">Log kebenaran dan keputusan</h2>
      <ul className="mt-1 text-sm">{(log ?? []).map((l) => <li key={l.id}>{fmt(l.created_at)} · {l.action} · {who.get(l.actor_id) ?? "?"} · {l.reason}</li>)}</ul>
    </main>
  );
}
