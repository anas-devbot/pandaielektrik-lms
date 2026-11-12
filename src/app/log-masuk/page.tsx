import Link from "next/link";
import { safeNext } from "@/lib/auth";
import { AuthShell, linkCls } from "@/components/auth";
import LogMasukForm from "./form";

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell title="Log masuk" lead="Teruskan pembelajaran anda." below={<>Belum ada akaun? <Link className={linkCls} href="/daftar">Daftar</Link></>}>
      <LogMasukForm next={safeNext(next) ?? ""} />
      <p className="mt-4 text-sm"><Link className={linkCls} href="/lupa-kata-laluan">Lupa kata laluan?</Link></p>
    </AuthShell>
  );
}
