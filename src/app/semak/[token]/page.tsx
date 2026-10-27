import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminClient } from "@/lib/supabase/admin";

// Halaman semakan AWAM (tiada log masuk). Hanya medan dalam certificate_public(): tiada emel, telefon atau enrollment.
export const metadata: Metadata = { title: "Semakan sijil", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const fmt = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "long", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));
const JENIS = { theory: "Sijil pencapaian teori", theory_practical: "Sijil teori dan praktikal" } as const;

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) notFound();
  const { data: c } = await adminClient().rpc("certificate_public", { p_token: token });
  if (!c) notFound();
  const ok = c.status === "sah";
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">Semakan sijil</h1>
      <p role="status" className={`mt-3 rounded border p-3 font-medium ${ok ? "border-green-600 text-green-700" : "border-red-600 text-red-700"}`}>
        {ok ? "Sijil ini SAH." : "Sijil ini TELAH DIBATALKAN."}
      </p>
      <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt>Nama</dt><dd className="font-medium">{String(c.holder_name).toUpperCase()}</dd>
        <dt>Jenis</dt><dd>{JENIS[c.type as keyof typeof JENIS]}</dd>
        <dt>Kursus</dt><dd>{c.course_title}</dd>
        <dt>Tempoh</dt><dd>{fmt(c.period_start)} hingga {fmt(c.period_end)}</dd>
        <dt>Dikeluarkan</dt><dd>{fmt(c.issued_at)}</dd>
        <dt>ID sijil</dt><dd>{c.cert_id}</dd>
      </dl>
    </main>
  );
}
