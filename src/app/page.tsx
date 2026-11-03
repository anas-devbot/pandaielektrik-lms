import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanding, rm } from "@/lib/course";
import { salesOpen } from "@/lib/sales";

export const dynamic = "force-dynamic"; // tarikh live dikemas kini admin tanpa deploy (cache dibatal melalui tag "landing")

export default async function Home() {
  const supabase = await createClient();
  // Data kursus dari cache, serentak dengan semakan sesi log masuk (satu round-trip, bukan tiga berturutan).
  const [{ course, sessions }, { data: { user } }] = await Promise.all([getLanding(), supabase.auth.getUser()]);
  const open = salesOpen(user?.email);
  const fmt = new Intl.DateTimeFormat("ms-MY", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" });

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-3xl font-semibold">{course?.title ?? "Kursus belum tersedia"}</h1>
      {course && (
        <>
          <p className="mt-4 text-2xl">{rm(course.price)} <span className="text-base">untuk seluruh program</span></p>
          <p className="text-sm">Bayaran tertakluk kepada <Link className="underline" href="/terma">terma dan syarat</Link>.</p>
          {open
            ? <Link href="/beli" className="mt-4 inline-block rounded bg-black px-4 py-2 text-white">Daftar dan bayar</Link>
            : <p className="mt-4 rounded border p-3">Pendaftaran belum dibuka. Sila kembali tidak lama lagi.</p>}
          <h2 className="mt-8 text-xl font-medium">Kursus live akan datang</h2>
          {sessions?.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {sessions.map((s) => (
                <li key={s.id} className="rounded border p-3">
                  <p>{fmt.format(new Date(s.starts_at))}{s.status === "full" ? " (penuh)" : ""}</p>
                  {s.venue_or_link && <p className="text-sm">{s.venue_or_link}</p>}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm">Tarikh akan diumumkan.</p>}
        </>
      )}
    </main>
  );
}
