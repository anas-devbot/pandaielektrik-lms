import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const nowMs = () => Date.now();
const age = (iso: string) => Math.floor((nowMs() - new Date(iso).getTime()) / 864e5);

// Gambaran penuh queue (semua penilai). Penilaian dibuat di /staff/semak dan /staff/praktikal.
export default async function Page() {
  await requireRole(["admin"]);
  const db = adminClient();
  const { data: pend } = await db.from("submissions").select("id, enrollment_id, type, created_at, claimed_by, claimed_at, enrollments!submissions_enrollment_id_fkey(profiles!enrollments_user_id_fkey(full_name))").eq("status", "pending").in("type", ["subjective", "schematic", "form", "video"]).order("created_at");
  const { data: course } = await db.from("courses").select("config").order("created_at").limit(1).single();
  const expiry = Number((course?.config as Record<string, unknown>)?.claim_expiry_days ?? 0) * 864e5;
  const { data: staff } = await db.from("profiles").select("id, full_name").in("role", ["reviewer", "approver", "admin"]);
  const who = new Map((staff ?? []).map((x) => [x.id, x.full_name]));
  const rows = (pend ?? []).map((s) => {
    const live = !!s.claimed_by && !!s.claimed_at && nowMs() - new Date(s.claimed_at).getTime() < expiry;
    return { ...s, name: (s.enrollments as unknown as { profiles: { full_name: string } | null } | null)?.profiles?.full_name ?? "?", holder: live ? who.get(s.claimed_by!) ?? "?" : null,
      href: s.type === "subjective" || s.type === "schematic" ? `/staff/semak/${s.enrollment_id}` : `/staff/praktikal/${s.enrollment_id}` };
  });
  const label = { subjective: "Subjektif", schematic: "Skematik", form: "Borang praktikal", video: "Video praktikal" } as const;
  return (
    <main className="py-4">
      <h1 className="text-2xl font-semibold">Queue penilaian ({rows.length})</h1>
      <p className="text-sm">Tuntutan luput selepas {expiry / 864e5} hari. Item paling lama dahulu.</p>
      {rows.length === 0 ? <p className="mt-3">Tiada item menunggu.</p> : (
        <table className="mt-3 w-full text-sm"><thead><tr className="text-left"><th>Pelajar</th><th>Jenis</th><th>Menunggu</th><th>Penilai</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td><Link className="underline" href={r.href}>{r.name}</Link></td><td>{label[r.type as keyof typeof label]}</td><td>{age(r.created_at)} hari</td><td>{r.holder ?? "belum dituntut"}</td></tr>)}</tbody></table>)}
    </main>
  );
}
