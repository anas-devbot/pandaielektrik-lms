import Link from "next/link";
import { AuthShell, FormError, linkCls } from "@/components/auth";
import LupaForm from "./form";

export default async function Page({ searchParams }: { searchParams: Promise<{ ralat?: string }> }) {
  const { ralat } = await searchParams;
  return (
    <AuthShell title="Lupa kata laluan" lead="Masukkan emel akaun anda. Kami akan hantar pautan untuk tetapkan kata laluan baharu." below={<Link className={linkCls} href="/log-masuk">Kembali ke log masuk</Link>}>
      {ralat === "pautan" && <div className="mb-3"><FormError>Pautan tidak sah atau sudah tamat. Minta pautan baharu.</FormError></div>}
      <LupaForm />
    </AuthShell>
  );
}
