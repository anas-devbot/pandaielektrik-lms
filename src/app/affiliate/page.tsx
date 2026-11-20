import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { getCourse } from "@/lib/course";
import { formatRM } from "@/lib/affiliate";
import { createClient } from "@/lib/supabase/server";
import { buttonClass } from "@/components/button";
import { MohonAffiliateForm } from "./forms";

export const dynamic = "force-dynamic";

// Halaman awam program affiliate. Semua angka polisi dibaca daripada courses.config (CLAUDE.md #12).
// Teks terma dan privasi ialah DRAF: menunggu semakan AHZ / Saiful sebelum diiklankan.
export default async function Page() {
  const course = await getCourse();
  const cfg = (course?.config ?? {}) as Record<string, unknown>;
  const rate = Number(cfg.affiliate_rate_pct);
  const cookieDays = Number(cfg.affiliate_cookie_days);
  const approveDays = Number(cfg.commission_approve_after_days);
  const payoutDay = Number(cfg.payout_day_of_month);
  const p = await getProfile();
  const supabase = await createClient();
  const { data: aff } = p ? await supabase.from("affiliates").select("status").eq("user_id", p.id).maybeSingle() : { data: null };

  const price = course?.price ?? 0;
  const contoh = Number.isFinite(rate) ? Math.floor((price * rate) / 100) : 0;
  const tidakSedia = !course || !Number.isFinite(rate);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="font-serif text-3xl font-semibold">Program affiliate PandaiElektrik</h1>
      <p className="mt-2">Kongsi kursus DIY Pendawaian Elektrik 1 Fasa dan terima komisen untuk setiap pendaftaran berbayar yang datang melalui pautan anda.</p>

      {tidakSedia ? (
        <p className="mt-6 text-error">Program affiliate belum tersedia.</p>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-xl font-semibold">Cara komisen dikira</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Komisen <strong>{rate}%</strong> daripada harga kursus ({formatRM(price)}) untuk setiap pendaftaran berbayar.</li>
              <li>Contoh pengiraan: 1 pendaftaran = {formatRM(contoh)}. 3 pendaftaran = {formatRM(contoh * 3)}. Ini pengiraan sahaja, bukan jaminan jualan atau pendapatan.</li>
              <li>Pautan rujukan menyimpan atribusi selama {cookieDays} hari. Pelajar yang guna pautan terakhir yang diklik ialah yang dikira.</li>
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-xl font-semibold">Bila komisen dibayar</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Komisen menjadi <strong>diluluskan</strong> selepas {approveDays} hari dari bayaran pelajar.</li>
              <li>Kiraan ditutup pada hujung bulan. Bayaran dibuat sekitar hari ke-{payoutDay} bulan berikut, melalui transfer bank oleh AHZ Teknik.</li>
              <li>Jika pelajar mendapat refund, komisen berkaitan dibatalkan. Jika komisen sudah dibayar, jumlah itu ditolak daripada bayaran bulan seterusnya.</li>
            </ol>
          </section>
        </>
      )}

      <section className="mt-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xl font-semibold">Larangan</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Jangan janjikan pendapatan, keuntungan atau kerja tetap kepada sesiapa.</li>
          <li>Jangan dakwa sijil kursus sebagai lesen, tauliah atau kelayakan pendawaian. Sijil ialah sijil penyertaan atau pencapaian AHZ Teknik, bukan sijil kompetensi.</li>
          <li>Jangan guna nama AHZ Teknik atau PandaiElektrik dengan cara yang mengelirukan atau palsu.</li>
          <li>Jangan hantar mesej spam atau bahan promosi tanpa kebenaran penerima.</li>
          <li>Jangan daftar melalui kod sendiri. Pendaftaran sendiri tidak dikira komisen.</li>
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="text-base font-semibold">Notis privasi affiliate (DRAF)</h2>
        <p className="mt-2">Kami simpan nama, emel, kod rujukan dan rekod komisen anda untuk urus program ini. Anda hanya nampak jumlah dan status komisen sendiri. Butiran pembeli tidak dipaparkan kepada anda. Tempoh simpan: <em>belum ditetapkan, menunggu AHZ Teknik</em>.</p>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="text-base font-semibold">Terma affiliate (DRAF)</h2>
        <p className="mt-2 font-semibold text-warning">Draf ini belum diluluskan AHZ Teknik. Jangan iklankan program ini sehingga disahkan.</p>
        <p className="mt-2">Terma penuh akan dipaparkan selepas diluluskan. Dengan memohon, anda bersetuju dengan larangan di atas dan keputusan AHZ terhadap komisen.</p>
      </section>

      <section className="mt-8">
        {!p ? (
          <>
            <p>Untuk mohon, sila log masuk dahulu. Pendaftaran akaun affiliate dibuka melalui pautan jemputan.</p>
            <Link href="/log-masuk?next=%2Faffiliate" className={buttonClass("primary", "mt-3")}>Log masuk untuk mohon</Link>
          </>
        ) : p.role !== "student" ? (
          <p>Akaun ini tidak boleh mendaftar sebagai affiliate.</p>
        ) : aff ? (
          <>
            <p>Anda sudah mendaftar sebagai affiliate. Status: <strong>{aff.status === "pending" ? "menunggu semakan" : aff.status === "approved" ? "diluluskan" : aff.status === "rejected" ? "tidak diluluskan" : "digantung"}</strong>.</p>
            <Link href="/affiliate/dashboard" className={buttonClass("secondary", "mt-3")}>Buka dashboard affiliate</Link>
          </>
        ) : tidakSedia ? null : (
          <>
            <h2 className="text-xl font-semibold">Mohon jadi affiliate</h2>
            <MohonAffiliateForm />
          </>
        )}
      </section>
    </main>
  );
}
