import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanding, rm } from "@/lib/course";
import { salesOpen } from "@/lib/sales";
import { buttonClass } from "@/components/button";

export const dynamic = "force-dynamic"; // katalog dan tarikh live dikemas kini admin tanpa deploy (cache dibatal melalui tag "landing")

// Checkout (/beli) masih untuk kursus pertama sahaja. CTA daftar hanya untuk kursus DIY sehingga checkout pelbagai kursus siap.
const SLUG_DAFTAR = "kursus-elektrik";

export default async function Home() {
  const supabase = await createClient();
  // Data katalog dari cache, serentak dengan semakan sesi log masuk.
  const [{ courses }, { data: { user } }] = await Promise.all([getLanding(), supabase.auth.getUser()]);
  const open = salesOpen(user?.email);
  const fmt = new Intl.DateTimeFormat("ms-MY", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      {courses.length === 0 && <h1 className="text-3xl font-semibold">Kursus belum tersedia</h1>}
      <div className="flex flex-col gap-6">
        {courses.map((c) => (
          <section key={c.id} className="rounded-md border border-border bg-surface p-4">
            {c.poster_key && (
              // Poster dikecilkan kepada 720×900 semasa muat naik. Dihidang melalui /api/poster (R2 privat, tiada URL R2 didedahkan).
              <img src={`/api/poster/${c.slug}`} alt={`Poster ${c.title}`} width={720} height={900} loading="lazy"
                className="mb-4 aspect-[4/5] w-full rounded-md object-cover" />
            )}
            <h1 className="text-3xl font-semibold">{c.title}</h1>
            {c.summary && <p className="mt-2">{c.summary}</p>}
            <p className="mt-3 text-2xl">{rm(c.price)} <span className="text-base">untuk seluruh program</span></p>

            {c.slug === SLUG_DAFTAR && (
              <>
                <p className="mt-1 text-sm">Bayaran tertakluk kepada <Link className="underline underline-offset-4" href="/terma">terma dan syarat</Link>.</p>
                {open
                  ? <Link href="/beli" className={buttonClass("primary", "mt-4 sm:w-auto")}>Daftar dan bayar</Link>
                  : <p className="mt-4 rounded-md border border-border p-3">Pendaftaran belum dibuka. Sila kembali tidak lama lagi.</p>}
              </>
            )}
            {c.cta_url && (
              <a href={c.cta_url} target="_blank" rel="noopener noreferrer"
                className={buttonClass(c.slug === SLUG_DAFTAR ? "secondary" : "primary", "mt-3 sm:w-auto")}>
                Sertai group WhatsApp
              </a>
            )}

            <h2 className="mt-6 text-xl font-semibold">Kursus live akan datang</h2>
            {c.sessions.length ? (
              <ul className="mt-2 flex flex-col gap-2">
                {c.sessions.map((s) => (
                  <li key={s.id} className="rounded-md border border-border p-3">
                    <p>{fmt.format(new Date(s.starts_at))}{s.status === "full" ? " (penuh)" : ""}</p>
                    {s.venue_or_link && <p className="text-sm">{s.venue_or_link}</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm">Tarikh akan diumumkan.</p>}
          </section>
        ))}
      </div>
    </main>
  );
}
