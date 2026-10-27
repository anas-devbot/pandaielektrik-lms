import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { logKeluar } from "@/app/log-masuk/actions";
import { PautanTelegram, RekodManual, TambahPercubaan } from "./forms";

// Slice 7: hanya dua tindakan admin yang diperlukan. Enam modul admin penuh dibina di slice 12.
export default async function Page() {
  const p = await requireRole(["admin"]);
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Kawasan admin</h1>
      <p className="mt-2">Selamat datang, {p.fullName} ({p.role}). <Link className="underline" href="/staff">Queue semakan</Link></p>
      <section className="mt-6 rounded border p-3">
        <h2 className="font-medium">Tambah percubaan MCQ akhir</h2>
        <p className="text-sm">Untuk pelajar yang telah menghabiskan had percubaan.</p>
        <TambahPercubaan />
      </section>
      <section className="mt-6 rounded border p-3">
        <h2 className="font-medium">Rekod penghantaran manual</h2>
        <RekodManual />
      </section>
      <section className="mt-6 rounded border p-3">
        <h2 className="font-medium">Pautan jemputan Telegram (trek praktikal)</h2>
        <p className="text-sm">Group dicipta manual oleh AHZ. Pautan dipaparkan di halaman praktikal pelajar.</p>
        <PautanTelegram />
      </section>
      <form action={logKeluar} className="mt-8"><button className="underline">Log keluar</button></form>
    </main>
  );
}
