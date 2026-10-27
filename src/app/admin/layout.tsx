import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { logKeluar } from "@/app/log-masuk/actions";

const MODUL = [
  ["/admin", "Menunggu tindakan"], ["/admin/queue", "Queue penilaian"], ["/admin/bekalan", "Kebenaran bekalan"],
  ["/admin/pelajar", "Pelajar & enrollment"], ["/admin/kursus", "Kursus & sesi live"], ["/admin/refund", "Refund"],
] as const;

// Enam modul admin (CLAUDE.md bahagian 9). Setiap halaman tetap memanggil requireRole sendiri; layout hanya navigasi.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await requireRole(["admin"]);
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-4">
      <nav aria-label="Modul admin" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b pb-2 text-sm">
        {MODUL.map(([href, label]) => <Link key={href} href={href} className="underline">{label}</Link>)}
        <span className="ml-auto text-xs">{me.fullName}</span>
        <form action={logKeluar}><button className="text-xs underline">Log keluar</button></form>
      </nav>
      {children}
    </div>
  );
}
