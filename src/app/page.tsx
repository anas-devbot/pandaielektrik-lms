import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanding, rm } from "@/lib/course";
import { salesOpen } from "@/lib/sales";
import { buttonClass } from "@/components/button";
import { LANDING } from "@/content/landing";
import { getLandingStats } from "@/lib/landing-stats";
import { Journey } from "@/components/landing/journey";
import { PhoneFrame } from "@/components/landing/phone-frame";
import { Checklist, CertSample, Faq, Instructor, NotFor, RefundNote, Section, StatStrip, StickyCta, Testimonials } from "@/components/landing/sections";

export const dynamic = "force-dynamic"; // katalog dan tarikh live dikemas kini admin tanpa deploy (cache dibatal melalui tag "landing")

// Checkout (/beli) masih untuk kursus pertama sahaja. CTA daftar hanya untuk kursus DIY sehingga checkout pelbagai kursus siap.
const SLUG_DAFTAR = "kursus-elektrik";

export default async function Home() {
  const supabase = await createClient();
  // Data katalog dari cache, serentak dengan semakan sesi log masuk.
  const [{ courses }, { data: { user } }] = await Promise.all([getLanding(), supabase.auth.getUser()]);
  const open = salesOpen(user?.email);
  // Pratonton blok DRAF: hanya emel dalam SALES_ALLOW_EMAILS, BUKAN bila SALES_OPEN=1 (awam tidak nampak penanda tempat).
  const preview = salesOpen(user?.email, { ...process.env, SALES_OPEN: "0" });
  const fmt = new Intl.DateTimeFormat("ms-MY", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" });
  const main = courses.find((c) => c.slug === SLUG_DAFTAR) ?? null;
  const stats = main ? await getLandingStats(main.id) : null;
  const ctaLabel = "Daftar dan bayar";
  const show = (b: { approved: boolean }) => b.approved || preview; // blok DRAF: tajuk dan isi disembunyikan daripada awam

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
          <Image src="/icon.png" alt="" width={32} height={32} className="size-8 rounded-full" />
          <span className="font-serif text-lg font-semibold">Pandai Elektrik</span>
          <Link href={user ? "/dashboard" : "/log-masuk"} className="ml-auto text-sm font-semibold underline underline-offset-4">{user ? "Akaun saya" : "Log masuk"}</Link>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-2xl px-4 pt-8 ${main && open ? "pb-28 md:pb-12" : "pb-12"}`}>
        {courses.length === 0 && <h1 className="font-serif text-3xl font-semibold">Kursus belum tersedia</h1>}

        {main && (
          <>
            <section aria-labelledby="hero">
              <p className="text-sm font-semibold text-gold-text">{main.title}</p>
              <h1 id="hero" className="mt-1 font-serif text-4xl font-semibold leading-[1.15]">{LANDING.hero.headline}</h1>
              <p className="mt-3 max-w-prose text-lg text-muted">{LANDING.hero.sub}</p>
              {main.summary && <p className="mt-3 max-w-prose">{main.summary}</p>}
              <p className="mt-5 font-serif text-3xl font-semibold"><span className="font-sans text-base font-normal text-muted">Hanya</span> {rm(main.price)} <span className="font-sans text-base font-normal text-muted">untuk seluruh program</span></p>
              <p className="mt-1 text-sm">Bayaran tertakluk kepada <Link className="font-semibold text-gold-text underline underline-offset-4" href="/terma">terma dan syarat</Link>.</p>
              {open
                ? <Link href="/beli" className={buttonClass("primary", "mt-4 sm:w-auto")}>{ctaLabel}</Link>
                : <p className="mt-4 rounded-md border border-border bg-surface p-3">Pendaftaran belum dibuka. Sila kembali tidak lama lagi.</p>}
              {main.cta_url && (
                <>
                  <p className="mt-5 max-w-prose text-sm text-muted">Sertai kumpulan WhatsApp Pandai Elektrik untuk dapatkan maklumat terkini tentang kursus dan kelas langsung.</p>
                  <a href={main.cta_url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "mt-2 sm:w-auto")}>Sertai kumpulan WhatsApp</a>
                </>
              )}
            </section>

            {stats && <StatStrip stats={stats} />}

            <Section title="Paparan program">
              <div className="flex items-start justify-center gap-4">
                <PhoneFrame src="/landing/dashboard.webp" alt="Halaman utama pelajar: kemajuan video, langkah semasa dan butang sambung tonton" width={375} height={812} caption="Halaman utama anda" />
                <PhoneFrame src="/landing/video.webp" alt="Paparan video dengan butang kembali ke halaman utama dan video seterusnya" width={375} height={812} caption="Paparan video" />
              </div>
            </Section>
            <Section title="Apa yang anda akan belajar"><Checklist items={LANDING.learn} /></Section>
            <Section title="Apa yang anda dapat"><Checklist items={LANDING.received} /></Section>
            {show(LANDING.testimonials) && <Section title="Kata peserta"><Testimonials block={LANDING.testimonials} note={LANDING.testimonialNote} /></Section>}
            <Section title="Dari daftar sampai dapat sijil"><Journey steps={LANDING.journey} branches={LANDING.journeyBranches} /></Section>
            {show(LANDING.certificate) && <Section title="Contoh sijil"><CertSample block={LANDING.certificate} preview={preview} /></Section>}
            {show(LANDING.instructor) && <Section title="Pengajar"><Instructor block={LANDING.instructor} preview={preview} /></Section>}
            <Section title="Apa kursus ini bukan"><NotFor items={LANDING.notFor} /></Section>
            {show(LANDING.refundNote) && <Section title="Bayaran balik (refund)"><RefundNote block={LANDING.refundNote} preview={preview} /></Section>}
            {show(LANDING.faq) && <Section title="Soalan lazim"><Faq block={LANDING.faq} preview={preview} /></Section>}
          </>
        )}

        {courses.length > 0 && (
          <Section title="Kursus lain dan kelas langsung">
            <div className="flex flex-col gap-6">
              {courses.map((c) => (
                <section key={c.id} className="rounded-lg border border-border bg-surface p-4">
                  {c.poster_key && (
                    // Poster dikecilkan kepada 720×900 semasa muat naik. Dihidang melalui /api/poster (R2 privat, tiada URL R2 didedahkan).
                    <img src={`/api/poster/${c.slug}`} alt={`Poster ${c.title}`} width={720} height={900} loading="lazy"
                      className="mb-4 aspect-[4/5] w-full rounded-md object-cover" />
                  )}
                  <h3 className="font-serif text-xl font-semibold">{c.title}</h3>
                  {c.slug !== SLUG_DAFTAR && c.summary && <p className="mt-2">{c.summary}</p>}
                  {c.slug !== SLUG_DAFTAR && <p className="mt-3 font-serif text-2xl font-semibold">{rm(c.price)}</p>}
                  {c.slug !== SLUG_DAFTAR && c.cta_url && (
                    <a href={c.cta_url} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "mt-3 sm:w-auto")}>Sertai kumpulan WhatsApp</a>
                  )}
                  {c.sessions.length > 0 && (
                    <>
                      <h4 className="mt-5 font-semibold">Kelas langsung akan datang</h4>
                      <ul className="mt-2 flex flex-col gap-2">
                        {c.sessions.map((s) => (
                          <li key={s.id} className="rounded-md border border-border p-3">
                            <p>{fmt.format(new Date(s.starts_at))}{s.status === "full" ? " (penuh)" : ""}</p>
                            {s.venue_or_link && <p className="text-sm">{s.venue_or_link}</p>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>
              ))}
            </div>
          </Section>
        )}
      </main>

      {main && open && <StickyCta href="/beli" label={ctaLabel} priceText={rm(main.price)} />}
    </>
  );
}
