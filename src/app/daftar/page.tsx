import Link from "next/link";
import { PRIVACY_NOTICE } from "@/content/privacy";
import { getCourse, rm } from "@/lib/course";
import { AuthShell, linkCls } from "@/components/auth";
import DaftarForm from "./form";

export default async function Page() {
  const course = await getCourse(); // harga dibaca dari DB; tiada kursus = baris konteks disembunyikan
  const context = course ? (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-paper px-3 py-2.5 text-sm">
      <span className="text-muted">Anda mendaftar untuk<b className="block font-serif text-[15px] font-semibold text-ink">{course.title}</b></span>
      <b className="font-serif text-base">{rm(course.price)}</b>
    </div>
  ) : null;
  return (
    <AuthShell title="Daftar akaun" lead="Satu akaun, akses penuh program. Bayaran dibuat selepas ini." context={context} below={<>Sudah ada akaun? <Link className={linkCls} href="/log-masuk">Log masuk</Link></>}>
      <DaftarForm notice={PRIVACY_NOTICE} />
    </AuthShell>
  );
}
