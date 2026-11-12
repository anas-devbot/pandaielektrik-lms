import Image from "next/image";
import { requireRole } from "@/lib/auth";
import { logKeluar } from "@/app/log-masuk/actions";
import { AdminNav, NavProvider } from "./nav";

// Tujuh modul admin (CLAUDE.md bahagian 9; Staf ditambah atas persetujuan Bos, 13 Nov 2026). Setiap halaman tetap memanggil requireRole sendiri; layout hanya navigasi.
// Gaya ikut DESIGN.md: bar sisi pada komputer, chip boleh diskrol pada telefon.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await requireRole(["admin"]);
  return (
    <NavProvider>
      <div className="mx-auto w-full max-w-6xl px-4">
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
        <div className="md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
          <div className="md:border-r md:border-border md:py-5 md:pr-4"><AdminNav /></div>
          <div className="py-6">{children}</div>
        </div>
      </div>
    </NavProvider>
  );
}
