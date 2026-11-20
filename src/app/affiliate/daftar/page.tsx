import Link from "next/link";
import { redirect } from "next/navigation";
import { PRIVACY_NOTICE } from "@/content/privacy";
import { getProfile } from "@/lib/auth";
import { AuthShell, linkCls } from "@/components/auth";
import DaftarForm from "@/app/daftar/form";

// Pautan jemputan sahaja (tidak dipautkan dari laman awam). noindex supaya tidak dikesan enjin carian.
export const metadata = { robots: { index: false, follow: false } };

// Pendaftaran akaun affiliate: akaun pelajar biasa (peranan student), tanpa pembelian kursus.
// Selepas daftar, pengguna dibawa ke /affiliate/dashboard (destinasi tetap dalam daftar/actions.ts).
export default async function Page() {
  if (await getProfile()) redirect("/affiliate");
  return (
    <AuthShell
      title="Daftar akaun affiliate"
      lead="Akaun untuk program affiliate PandaiElektrik. Tiada pembelian kursus diperlukan untuk mohon."
      below={<>Sudah ada akaun? <Link className={linkCls} href="/log-masuk?next=%2Faffiliate">Log masuk</Link></>}
    >
      <DaftarForm notice={PRIVACY_NOTICE} tujuan="affiliate" />
    </AuthShell>
  );
}
