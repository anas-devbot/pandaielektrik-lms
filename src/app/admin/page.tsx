import { requireRole } from "@/lib/auth";
import { logKeluar } from "@/app/log-masuk/actions";

export default async function Page() {
  const p = await requireRole(["admin"]);
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Kawasan admin</h1>
      <p className="mt-2">Selamat datang, {p.fullName} ({p.role}).</p>
      <form action={logKeluar} className="mt-4"><button className="underline">Log keluar</button></form>
    </main>
  );
}
