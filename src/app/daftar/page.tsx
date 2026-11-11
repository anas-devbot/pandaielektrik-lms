import Link from "next/link";
import { PRIVACY_NOTICE } from "@/content/privacy";
import DaftarForm from "./form";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">Daftar akaun</h1>
      <DaftarForm notice={PRIVACY_NOTICE} />
      <p className="mt-4 text-sm">Sudah ada akaun? <Link className="underline" href="/log-masuk">Log masuk</Link></p>
    </main>
  );
}
