import Link from "next/link";
import LupaForm from "./form";

export default async function Page({ searchParams }: { searchParams: Promise<{ ralat?: string }> }) {
  const { ralat } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">Lupa kata laluan</h1>
      <p className="mt-2 text-sm">Masukkan emel akaun anda. Kami akan hantar pautan untuk tetapkan kata laluan baharu.</p>
      {ralat === "pautan" && <p role="alert" className="mt-4 text-sm text-error">Pautan tidak sah atau sudah tamat. Minta pautan baharu.</p>}
      <LupaForm />
      <p className="mt-4 text-sm"><Link className="underline" href="/log-masuk">Kembali ke log masuk</Link></p>
    </main>
  );
}
