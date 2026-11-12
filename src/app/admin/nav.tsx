"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Navigasi admin: bar sisi (md ke atas) dan chip boleh diskrol (telefon). Angka bilangan menunggu
// hanya diisi oleh halaman "Menunggu tindakan" melalui SetNavCounts (tiada pertanyaan tambahan di halaman lain).
export type NavCounts = Partial<Record<string, number>> & { warn?: string[] };
const MODUL = [
  ["/admin", "Menunggu tindakan", "Menunggu"],
  ["/admin/queue", "Queue penilaian", "Queue"],
  ["/admin/bekalan", "Kebenaran bekalan", "Bekalan"],
  ["/admin/pelajar", "Pelajar & enrollment", "Pelajar"],
  ["/admin/kursus", "Kursus & sesi live", "Kursus"],
  ["/admin/refund", "Refund", "Refund"],
  ["/admin/staf", "Staf", "Staf"],
] as const;

const Ctx = createContext<{ counts: NavCounts; set: (c: NavCounts) => void }>({ counts: {}, set: () => {} });

export function NavProvider({ children }: { children: ReactNode }) {
  const [counts, set] = useState<NavCounts>({});
  return <Ctx.Provider value={{ counts, set }}>{children}</Ctx.Provider>;
}

export function SetNavCounts({ counts }: { counts: NavCounts }) {
  const { set } = useContext(Ctx);
  const key = JSON.stringify(counts);
  useEffect(() => { set(JSON.parse(key)); return () => set({}); }, [key, set]);
  return null;
}

function on(path: string, href: string) {
  return href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/");
}

export function AdminNav() {
  const path = usePathname();
  const { counts } = useContext(Ctx);
  const badge = (href: string) => (counts[href] ? counts[href] : null);
  return (
    <>
      <nav aria-label="Modul admin" className="hidden md:block">
        <ul className="flex flex-col gap-0.5">
          {MODUL.map(([href, label]) => {
            const active = on(path, href); const n = badge(href);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-10 items-center justify-between rounded-md px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-info ${active ? "bg-ink text-paper" : "text-ink hover:bg-border/40"}`}>
                  {label}
                  {n ? <span className={`rounded-full px-2 text-xs font-bold ${active ? "bg-gold text-ink" : "bg-border text-ink"}`}>{n}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <nav aria-label="Modul admin" className="-mx-4 flex gap-1.5 overflow-x-auto border-b border-border bg-surface px-4 py-2 md:hidden">
        {MODUL.map(([href, , short]) => {
          const active = on(path, href); const n = badge(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm font-semibold ${active ? "border-ink bg-ink text-paper" : "border-border bg-paper text-ink"}`}>
              {short}{n ? ` ${n}` : ""}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
