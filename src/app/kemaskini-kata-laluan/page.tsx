import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import KemaskiniForm from "./form";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">Tetapkan kata laluan baharu</h1>
      {user ? (
        <KemaskiniForm />
      ) : (
        <p className="mt-4 text-sm">Pautan tidak sah atau sudah tamat. <Link className="underline" href="/lupa-kata-laluan">Minta pautan baharu</Link>.</p>
      )}
    </main>
  );
}
