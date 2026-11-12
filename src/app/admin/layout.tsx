import Image from "next/image";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { logKeluar } from "@/app/log-masuk/actions";

const MODUL = [
  ["/admin", "Menunggu tindakan"], ["/admin/queue", "Queue penilaian"], ["/admin/bekalan", "Kebenaran bekalan"],
  ["/admin/pelajar", "Pelajar & enrollment"], ["/admin/kursus", "Kursus & sesi live"], ["/admin/refund", "Refund"],
] as const;

// Enam modul admin (CLAUDE.md bahagian 9). Setiap halaman tetap memanggil requireRole sendiri; layout hanya navigasi.
// Gaya ikut DESIGN.md: header kertas dengan garis sempadan, navigasi boleh disentuh (48px), dan melimpah ke kanan pada telefon.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await requireRole(["admin"]);
  return (
    <div className="mx-auto w-full max-w-4xl px-4">
      <header className="flex items-center gap-3 border-b border-border py-3">
        <Image src="/icon.png" alt="" width={32} height={32} className="size-8 rounded-full" />
        <div className="min-w-0">
          <p className="font-serif text-lg font-semibold leading-tight">Admin Pandai Elektrik</p>
          <p className="truncate text-xs text-muted">{me.fullName}</p>
        </div>
        <form action={logKeluar} className="ml-auto">
          <button className="min-h-10 rounded-md px-3 text-sm font-semibold underline underline-offset-4">Log keluar</button>
        </form>
      </header>
      <nav aria-label="Modul admin" className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 py-2 text-sm">
        {MODUL.map(([href, label]) => (
          <Link key={href} href={href} className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-transparent px-3 font-medium hover:border-border hover:bg-surface">
            {label}
          </Link>
        ))}
      </nav>
      <div className="py-6">{children}</div>
    </div>
  );
}
