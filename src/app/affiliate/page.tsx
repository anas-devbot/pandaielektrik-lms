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
          <li>Tidak dibenarkan menjanjikan pendapatan, keuntungan atau kerja tetap kepada sesiapa.</li>
          <li>Tidak dibenarkan mendakwa sijil kursus sebagai lesen, tauliah atau kelayakan pendawaian. Sijil ialah sijil penyertaan atau pencapaian AHZ Teknik, bukan sijil kompetensi.</li>
          <li>Tidak dibenarkan menggunakan nama AHZ Teknik atau PandaiElektrik dengan cara yang mengelirukan atau palsu.</li>
          <li>Tidak dibenarkan menghantar mesej spam atau bahan promosi tanpa kebenaran penerima.</li>
          <li>Tidak dibenarkan mendaftar melalui kod sendiri. Pendaftaran sendiri tidak dikira komisen.</li>
          <li>Tidak dibenarkan membuat iklan berbentuk clickbait, iaitu tajuk atau janji yang menyesatkan semata-mata untuk meraih klik.</li>
          <li>Tidak dibenarkan mempromosikan sebarang perkara yang mengandungi gharar, atau yang diharamkan menurut agama Islam.</li>
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="text-base font-semibold">Notis privasi affiliate (DRAF)</h2>
        <p className="mt-2">Kami simpan nama, emel, kod rujukan dan rekod komisen anda untuk urus program ini. Anda hanya nampak jumlah dan status komisen sendiri. Butiran pembeli tidak dipaparkan kepada anda. Tempoh simpan: <em>belum ditetapkan, menunggu AHZ Teknik</em>.</p>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="text-base font-semibold">Terma affiliate (DRAF)</h2>
        <p className="mt-2 font-semibold text-warning">Draf ini belum diluluskan AHZ Teknik. Tidak dibenarkan mengiklankan program ini sehingga disahkan.</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li><strong>Pengenalan.</strong> Terma ini mengawal penyertaan dalam program affiliate PandaiElektrik. Dengan memohon, anda bersetuju dengan terma ini dan larangan di atas.</li>
          <li><strong>Kelayakan.</strong> Akaun mesti atas nama sendiri dan maklumat yang diberikan mesti benar. Staf AHZ Teknik dan PandaiElektrik tidak layak memohon.</li>
          <li><strong>Kod rujukan.</strong> Kod ialah unik dan tidak boleh ditukar selepas diluluskan. Kod tidak boleh dijual atau dipindahkan kepada pihak lain.</li>
          <li><strong>Komisen.</strong> {rate}% daripada harga penuh kursus bagi setiap pendaftaran berbayar. Komisen diluluskan {approveDays} hari selepas bayaran pelajar.</li>
          <li><strong>Atribusi.</strong> Pautan rujukan menyimpan atribusi {cookieDays} hari. Pautan terakhir yang diklik ialah yang dikira. Pelajar yang sudah berdaftar sebelum pautan diklik tidak dikira. Pendaftaran sendiri tidak dikira.</li>
          <li><strong>Refund.</strong> Jika pelajar mendapat refund, komisen berkaitan dibatalkan. Jika komisen sudah dibayar, jumlah itu ditolak daripada bayaran bulan berikutnya.</li>
          <li><strong>Pembayaran.</strong> Kiraan ditutup pada hujung bulan. Bayaran dibuat sekitar hari ke-{payoutDay} bulan berikut melalui transfer bank oleh AHZ Teknik. Tiada had bayaran minimum. Butiran bank mesti tepat; kesilapan butiran yang diberikan menjadi tanggungjawab affiliate.</li>
          <li><strong>Penggantungan dan penamatan.</strong> AHZ Teknik boleh menggantung atau menamatkan affiliate yang melanggar larangan atau terma ini. Komisen yang belum diluluskan bagi affiliate yang digantung tidak akan diluluskan.</li>
          <li><strong>Cukai.</strong> Tanggungjawab cukai atas komisen belum diputuskan AHZ Teknik.</li>
          <li><strong>Keputusan.</strong> Keputusan AHZ Teknik mengenai kelayakan, kelulusan dan jumlah komisen adalah muktamad, kecuali kesilapan jelas yang dibetulkan.</li>
          <li><strong>Pindaan.</strong> AHZ Teknik boleh meminda terma ini. Tempoh notis pindaan belum ditetapkan.</li>
          <li><strong>Undang-undang.</strong> Terma ini tertakluk kepada undang-undang Malaysia.</li>
        </ol>
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
