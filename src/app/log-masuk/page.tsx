import Link from "next/link";
import { safeNext } from "@/lib/auth";
import LogMasukForm from "./form";

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">Log masuk</h1>
      <LogMasukForm next={safeNext(next) ?? ""} />
      <p className="mt-4 text-sm"><Link className="underline" href="/lupa-kata-laluan">Lupa kata laluan?</Link></p>
      <p className="mt-4 text-sm">Belum ada akaun? <Link className="underline" href="/daftar">Daftar</Link></p>
    </main>
  );
}
