import { getCourse } from "@/lib/course";

export default async function Page() {
  const c = (await getCourse())?.config as Record<string, number> | undefined;
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Terma dan syarat</h1>
      <p className="mt-2 rounded-md border bg-surface border-warning p-3 text-sm">DRAF: menunggu semakan dan kelulusan AHZ Teknik. Belum sah sebagai terma rasmi.</p>
      <h2 className="mt-6 text-lg font-medium">Refund</h2>
      {/* ASSUMPTION: belum disahkan Saiful. Nilai dari config kursus; teks sebenar menunggu AHZ. */}
      <p className="mt-1">Permohonan refund boleh dibuat dalam {c?.refund_window_days ?? "?"} hari dari tarikh bayaran, tertakluk semakan automatik (kemajuan pembelajaran tidak melebihi {c?.refund_progress_max_pct ?? "?"}% dan tiada penghantaran atau percubaan ujian akhir).</p>
      <h2 className="mt-6 text-lg font-medium">Akses</h2>
      <p className="mt-1">Akses video dan bahan ialah {c?.access_months ?? "?"} bulan dari tarikh bayaran. Sijil dan rekod kekal sah selepas akses tamat.</p>
      <h2 className="mt-6 text-lg font-medium">Penilaian</h2>
      <p className="mt-1">Semakan subjektif, skematik dan praktikal dilakukan dalam tempoh {c?.sla_business_days ?? "?"} hari bekerja.</p>
    </main>
  );
}
