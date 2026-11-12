import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { logKeluar } from "@/app/log-masuk/actions";

export const dynamic = "force-dynamic";
const nowMs = () => Date.now();

export default async function Page() {
  const me = await requireRole(["reviewer", "approver", "admin"]);
  const db = adminClient();
  const { data: pend } = await db.from("submissions")
    .select("id, enrollment_id, type, created_at, claimed_by, claimed_at, enrollments!submissions_enrollment_id_fkey(profiles!enrollments_user_id_fkey(full_name))")
    .eq("status", "pending").in("type", ["subjective", "schematic"]).order("created_at");
  const { data: pprac } = await db.from("submissions")
    .select("id, enrollment_id, type, created_at, claimed_by, claimed_at, enrollments!submissions_enrollment_id_fkey(profiles!enrollments_user_id_fkey(full_name))")
    .eq("status", "pending").in("type", ["form", "video"]).order("created_at");
  const { data: practical } = await db.from("enrollments")
    .select("id, energize_approved_at, practical_result, profiles!enrollments_user_id_fkey(full_name)").eq("stage", "practical").is("practical_result", null);
  const { data: latestSubs } = await db.from("submissions").select("enrollment_id, type, status, attempt_no").in("type", ["form", "video"]).in("enrollment_id", (practical ?? []).map((x) => x.id)).order("attempt_no", { ascending: false });
  const { data: courses } = await db.from("courses").select("config").order("created_at").limit(1);
  const expiryDays = Number((courses?.[0]?.config as Record<string, unknown> | undefined)?.claim_expiry_days ?? 0);
  const { data: staff } = await db.from("profiles").select("id, full_name").in("role", ["reviewer", "approver", "admin"]);
  const names = new Map((staff ?? []).map((s) => [s.id, s.full_name]));

  const groups = new Map<string, { name: string; since: string; types: string[]; holder: string | null; mine: boolean }>();
  const noType: string[] = [];
  for (const s of pend ?? []) {
    const e = s.enrollments as unknown as { profiles: { full_name: string } | null } | null;
    const live = s.claimed_by && s.claimed_at && nowMs() - new Date(s.claimed_at).getTime() < expiryDays * 864e5;
    const g = groups.get(s.enrollment_id) ?? { name: e?.profiles?.full_name ?? "?", since: s.created_at, types: noType.slice(), holder: null, mine: false };
    g.types.push(s.type === "subjective" ? "subjektif" : "skematik");
    if (live) { g.holder = names.get(s.claimed_by!) ?? "penilai"; g.mine = s.claimed_by === me.id; }
    groups.set(s.enrollment_id, g);
  }
  const latestOf = (eid: string, t: string) => (latestSubs ?? []).find((x) => x.enrollment_id === eid && x.type === t);
  const waitApproval = (practical ?? []).filter((x) => !x.energize_approved_at && latestOf(x.id, "form")?.status === "approved" && latestOf(x.id, "video")?.status === "approved");
  const waitResult = (practical ?? []).filter((x) => !!x.energize_approved_at);
  const pname = (x: { profiles: unknown }) => (x.profiles as { full_name: string } | null)?.full_name ?? "?";
  const pgroups = new Map<string, { name: string; types: string[] }>();
  for (const s of pprac ?? []) {
    const en = s.enrollments as unknown as { profiles: { full_name: string } | null } | null;
    const g = pgroups.get(s.enrollment_id) ?? { name: en?.profiles?.full_name ?? "?", types: [] as string[] };
    g.types.push(s.type === "form" ? "borang" : "video"); pgroups.set(s.enrollment_id, g);
  }
  const fmt = new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" });

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Queue semakan</h1>
      <p className="mt-1 text-sm">{me.fullName} ({me.role}){me.role === "admin" && <> · <Link className="underline" href="/admin">Kawasan admin</Link></>}</p>
      {groups.size === 0 ? <p className="mt-4">Tiada item menunggu semakan.</p> : (
        <ul className="mt-4 flex flex-col gap-2">
          {[...groups].map(([eid, g]) => (
            <li key={eid} className="rounded-md border border-border bg-surface p-3">
              <Link className="font-medium underline" href={`/staff/semak/${eid}`}>{g.name}</Link>
              <p className="text-sm">{g.types.join(" + ")} · sejak {fmt.format(new Date(g.since))}
                {g.holder && ` · dituntut ${g.mine ? "oleh anda" : `oleh ${g.holder}`}`}</p>
            </li>))}
        </ul>)}
      <h2 className="mt-8 text-lg font-medium">Praktikal</h2>
      <ul className="mt-2 flex flex-col gap-2 text-sm">
        {[...pgroups].map(([eid, g]) => <li key={eid} className="rounded-md border border-border bg-surface p-3"><Link className="font-medium underline" href={`/staff/praktikal/${eid}`}>{g.name}</Link>: semak {g.types.join(" + ")}</li>)}
        {waitApproval.map((x) => <li key={x.id} className="rounded-md border bg-surface border-error p-3"><Link className="font-medium underline" href={`/staff/praktikal/${x.id}`}>{pname(x)}</Link>: menunggu kelulusan bekalan (approver)</li>)}
        {waitResult.map((x) => <li key={x.id} className="rounded-md border border-border bg-surface p-3"><Link className="font-medium underline" href={`/staff/praktikal/${x.id}`}>{pname(x)}</Link>: menunggu keputusan praktikal</li>)}
        {pgroups.size + waitApproval.length + waitResult.length === 0 && <li>Tiada tindakan praktikal.</li>}
      </ul>
      <form action={logKeluar} className="mt-8"><button className="underline">Log keluar</button></form>
    </main>
  );
}
