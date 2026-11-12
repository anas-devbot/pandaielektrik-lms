// Teks landing kursus DIY. Blok approved:false ialah penanda tempat yang menunggu AHZ: tidak dipaparkan kepada awam (hanya pratonton).
// Dilarang: janji gaji/kerja, "layak", bonus/kuota rekaan (lihat scripts/test-landing-content.mjs). Sapaan "anda".
export type Block<T> = { approved: boolean; value: T };

export const LANDING = {
  hero: {
    headline: "Faham elektrik rumah anda, selangkah demi selangkah",
    sub: "Kursus belajar sendiri mengikut masa anda, diajar oleh Saiful, AHZ Teknik.",
  },
  learn: [
    "Asas elektrik 1 fasa dan bekalan elektrik ke rumah",
    "Meter panel dan DB 1 fasa: fungsi, susunan dan pendawaian dalam DB",
    "Peralatan, keselamatan, jenis kabel dan alat tambah",
    "Menggunakan clamp meter digital",
    "Mengesan kabel tanpa marking, serta melukis skematik dan layout rumah",
    "Pengenalan DB 3 fasa dan membuat papan latihan",
  ],
  received: [
    "Video pelajaran mengikut turutan, dengan nota PDF",
    "Ujian akhir dalam LMS",
    "Semakan fasilitator ke atas skematik dan jawapan subjektif anda",
    "Sijil penyertaan atau pencapaian AHZ Teknik dengan kod QR semakan",
    "Belajar mengikut masa sendiri, boleh ulang tonton",
    "Jejak kemajuan dan langkah seterusnya yang sentiasa jelas",
  ],
  journey: [
    { n: 1, title: "Daftar dan bayar", text: "Buat akaun dan bayar sekali. Akses bermula pada tarikh bayaran." },
    { n: 2, title: "Akses bahan", text: "Muat turun ebook dan buka senarai video. Sertai group WhatsApp untuk sokongan tutor." },
    { n: 3, title: "Belajar", text: "Tonton video mengikut turutan. Bar kemajuan menunjukkan di mana anda berada." },
    { n: 4, title: "Ujian akhir", text: "Dibuka selepas setiap video dicapai. Dijawab dalam LMS." },
    { n: 5, title: "Subjektif dan skematik", text: "Hantar jawapan dan skematik anda. Fasilitator menyemak dan memberi komen." },
    { n: 6, title: "Pilih sijil", text: "Teori sahaja, atau teori dan praktikal. Praktikal ialah pilihan dan kelulusannya manual oleh AHZ." },
    { n: 7, title: "Terima sijil", text: "Sijil penyertaan atau pencapaian AHZ Teknik dengan kod QR semakan." },
  ],
  journeyBranches: [
    { title: "Teori sahaja", text: "Terus ke Sijil Pencapaian Teori." },
    { title: "Teori dan praktikal (pilihan)", text: "Tugasan praktikal pada papan, semakan dan kelulusan manual oleh AHZ, kemudian keputusan praktikal. Sijil Teori dan Praktikal." },
  ],
  notFor: [
    "Bukan lesen wireman atau lesen Suruhanjaya Tenaga.",
    "Bukan sijil kompetensi. Sijil ialah sijil penyertaan atau pencapaian AHZ Teknik.",
    "Tidak memberi kebenaran untuk membuat kerja pendawaian yang dikawal Suruhanjaya Tenaga.",
  ],
  instructor: { approved: false, value: { name: "Saiful", role: "Pengajar, AHZ Teknik", bio: "[Menunggu bio daripada Saiful dan kelulusan AHZ]", photo: null as string | null } } as Block<{ name: string; role: string; bio: string; photo: string | null }>,
  faq: { approved: false, value: [{ q: "[Menunggu soalan lazim daripada Saiful]", a: "[Menunggu jawapan yang diluluskan AHZ]" }] } as Block<{ q: string; a: string }[]>,
  certificate: { approved: false, value: { caption: "[Menunggu kelulusan AHZ untuk contoh sijil]" } } as Block<{ caption: string }>,
  refundNote: { approved: false, value: "[Menunggu teks refund yang diluluskan AHZ]" } as Block<string>,
} as const;
