// Teks landing kursus DIY. Blok approved:false ialah penanda tempat yang menunggu AHZ: tidak dipaparkan kepada awam (hanya pratonton).
// Dilarang: janji gaji/kerja, "layak", bonus/kuota rekaan (lihat scripts/test-landing-content.mjs). Sapaan "anda".
export type Block<T> = { approved: boolean; value: T };

export const LANDING = {
  hero: {
    headline: "Faham elektrik rumah anda, selangkah demi selangkah",
    sub: "Belajar sendiri mengikut masa anda. Latihan dan bimbingan disediakan oleh penceramah dan fasilitator bertauliah dari AHZ Teknik.",
  },
  learn: [
    "Asas elektrik 1 fasa dan cara bekalan elektrik sampai ke rumah",
    "Meter dan papan agihan (DB) 1 fasa: fungsi dan susunannya",
    "Peralatan, langkah keselamatan, jenis kabel dan alat tambah",
    "Cara guna clamp meter digital",
    "Mengesan kabel yang tiada tanda, dan melukis skematik serta pelan pendawaian rumah",
    "Pengenalan papan agihan 3 fasa dan cara membuat papan latihan",
  ],
  received: [
    "Video pelajaran yang disusun ikut turutan, dengan nota PDF",
    "Ujian akhir yang dijawab terus di laman ini",
    "Semakan oleh fasilitator ke atas jawapan dan lukisan skematik anda",
    "Sijil penyertaan atau pencapaian AHZ Teknik, dengan kod QR untuk disahkan",
    "Belajar ikut masa sendiri, dan boleh tonton berulang kali",
    "Bar kemajuan yang menunjukkan di mana anda berada dan apa langkah seterusnya",
  ],
  journey: [
    { n: 1, title: "Daftar dan bayar", text: "Buat akaun, bayar sekali sahaja. Akses anda bermula pada tarikh bayaran." },
    { n: 2, title: "Ambil bahan", text: "Muat turun ebook dan buka senarai video. Sertai kumpulan WhatsApp jika perlu bantuan tutor." },
    { n: 3, title: "Belajar", text: "Tonton video ikut turutan. Bar kemajuan menunjukkan setakat mana anda sudah belajar." },
    { n: 4, title: "Ujian akhir", text: "Dibuka selepas anda habis menonton setiap video. Dijawab terus di laman ini." },
    { n: 5, title: "Jawapan bertulis dan skematik", text: "Hantar jawapan bertulis dan lukisan skematik anda. Fasilitator menyemak dan memberi komen." },
    { n: 6, title: "Pilih sijil", text: "Pilih teori sahaja, atau teori dan praktikal. Praktikal tidak wajib, dan kelulusannya dibuat sendiri oleh AHZ." },
    { n: 7, title: "Terima sijil", text: "Sijil penyertaan atau pencapaian AHZ Teknik, dengan kod QR." },
  ],
  journeyBranches: [
    { title: "Teori sahaja", text: "Terus dapat Sijil Pencapaian Teori." },
    { title: "Teori dan praktikal (pilihan)", text: "Anda buat tugasan praktikal pada papan. AHZ menyemak dan meluluskan secara manual, kemudian keputusan praktikal direkod. Selepas itu anda dapat Sijil Teori dan Praktikal." },
  ],
  notFor: [
    "Bukan lesen wireman, dan bukan lesen Suruhanjaya Tenaga.",
    "Bukan sijil kompetensi. Ini sijil penyertaan atau pencapaian daripada AHZ Teknik.",
    "Tidak memberi kebenaran untuk membuat kerja pendawaian yang dikawal Suruhanjaya Tenaga.",
  ],
  instructor: { approved: false, value: { name: "Saiful", role: "Pengajar, AHZ Teknik", bio: "[Menunggu bio daripada Saiful dan kelulusan AHZ]", photo: null as string | null } } as Block<{ name: string; role: string; bio: string; photo: string | null }>,
  faq: { approved: false, value: [{ q: "[Menunggu soalan lazim daripada Saiful]", a: "[Menunggu jawapan yang diluluskan AHZ]" }] } as Block<{ q: string; a: string }[]>,
  certificate: { approved: false, value: { caption: "[Menunggu kelulusan AHZ untuk contoh sijil]" } } as Block<{ caption: string }>,
  refundNote: { approved: false, value: "[Menunggu teks refund yang diluluskan AHZ]" } as Block<string>,
} as const;
