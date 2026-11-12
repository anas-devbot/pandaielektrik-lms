import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthShell, linkCls } from "@/components/auth";
import KemaskiniForm from "./form";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <AuthShell title="Tetapkan kata laluan baharu">
      {user ? (
        <KemaskiniForm />
      ) : (
        <p className="text-sm">Pautan tidak sah atau sudah tamat. <Link className={linkCls} href="/lupa-kata-laluan">Minta pautan baharu</Link>.</p>
      )}
    </AuthShell>
  );
}
