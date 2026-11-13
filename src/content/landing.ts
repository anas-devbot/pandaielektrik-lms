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
  // Petikan asal peserta kelas langsung (31 Mac dan 1 April 2026), dengan kebenaran mereka (diberi semasa Google Meet).
  // JANGAN tambah petikan yang menyebut peserta boleh/mampu/yakin membuat kerja pendawaian (peraturan 10; dijaga oleh ujian).
  testimonials: {
    approved: true,
    value: [
      { quote: "Kursus asas elektrik, walaupun online, memang boleh bagi kefahaman yang sangat jelas.", name: "Kornain Othman", featured: true },
      { quote: "Saya dapat memahami setiap item yang digunakan dalam pendawaian elektrik single phase di rumah. Jadi tempat rujukan, sebab selama ini saya hanya menggunakan YouTube dan Google sahaja.", name: "Muhammad Nazmi bin Muhammad Fauzi", featured: false },
      { quote: "Terima kasih cikgu kerana memberi penerangan yang ringkas dan padat.", name: "Lanun Darat", featured: false },
    ],
  } as Block<{ quote: string; name: string; featured: boolean }[]>,
  testimonialNote: "Petikan daripada mesej peserta kelas langsung Asas Elektrik AHZ Teknik, 31 Mac dan 1 April 2026, dengan kebenaran mereka.",
  // Teks disusun Bos (13 Nov 2026) daripada CV Saiful. Gambar belum ada (logo pada baju perlu di-crop). Saiful perlu baca sebelum deploy.
  instructor: {
    approved: true,
    value: {
      name: "Mohd Saiful Akmal bin A. Karim",
      role: "Pakar Industri Kejuruteraan Elektrik & Pengurusan Fasiliti",
      paragraphs: [
        "Berpengalaman lebih 25 tahun dalam bidang kejuruteraan elektrik, pengurusan projek Mechanical & Electrical (M&E), penyelenggaraan fasiliti serta latihan teknikal.",
        "Beliau merupakan Pengarah Mazateknik Sdn. Bhd. sejak tahun 2000 dan turut aktif sebagai perunding latihan elektrik serta pembangunan kemahiran teknikal.",
        "Sepanjang kerjayanya, beliau terlibat dalam pelbagai projek dan operasi fasiliti utama termasuk KLIA, Menara Kawalan DCA, TNB, USIM, JKR serta fasiliti kerajaan dan institusi awam.",
        "Dengan gabungan pengalaman pengurusan projek, kepakaran teknikal dan penglibatan langsung dalam industri, beliau membawa pendekatan latihan yang berteraskan pengalaman sebenar, aplikasi praktikal dan keperluan industri.",
      ],
      stats: [
        { big: "25+", label: "Tahun pengalaman industri" },
        { big: "2000", label: "Pengarah syarikat sejak" },
        { big: "M&E", label: "Pengalaman projek & fasiliti" },
      ],
      photo: null as string | null,
    },
  } as Block<{ name: string; role: string; paragraphs: string[]; stats: { big: string; label: string }[]; photo: string | null }>,
  // Templat: {hari_refund}, {peratus_refund}, {bulan_akses}, {soalan_ujian}, {markah_lulus}, {had_percubaan}, {hari_semakan}, {potongan}
  // diisi dari courses.config semasa render (lihat statVars dalam src/lib/landing-shape.ts). Baris dengan nilai tiada dibuang.
  // Faq dan refundNote disahkan Bos (13 Nov 2026): potongan refund RM5, semakan 5 hari bekerja.
  faq: {
    approved: true,
    value: [
      { q: "Kursus ini sesuai untuk siapa?", a: "Untuk sesiapa yang mahu memahami asas elektrik rumah 1 fasa: dari bekalan ke rumah, meter dan DB, sehingga kabel, peralatan dan skematik." },
      { q: "Adakah ini kursus untuk menjadi pendawai berlesen?", a: "Tidak. Ini bukan lesen wireman atau lesen Suruhanjaya Tenaga, dan bukan sijil kompetensi. Anda mendapat sijil penyertaan atau pencapaian daripada AHZ Teknik. Kerja pendawaian yang dikawal Suruhanjaya Tenaga memerlukan pihak yang didaftarkan dan dibenarkan oleh Suruhanjaya Tenaga." },
      { q: "Berapa lama saya boleh belajar?", a: "Anda ada akses selama {bulan_akses} bulan dari tarikh bayaran. Dalam tempoh itu anda boleh menonton dan mengulang video serta memuat turun nota PDF. Selepas akses tamat, video dan PDF ditutup, tetapi sijil dan rekod anda kekal sah." },
      { q: "Bagaimana ujian akhir berfungsi?", a: "Ujian akhir dibuka selepas kesemua video selesai ditonton." },
      { q: "Apa yang perlu saya hantar untuk disemak?", a: "Selepas lulus ujian akhir, anda menghantar jawapan subjektif dan skematik. Fasilitator menyemak dan memberi komen, dan anda boleh menghantar semula jika perlu diperbaiki. Semakan mengambil masa {hari_semakan} hari bekerja." },
      { q: "Apa beza sijil teori sahaja dengan teori dan praktikal?", a: "Teori sahaja memberi Sijil Pencapaian Teori selepas anda lulus ujian dan semakan. Teori dan praktikal ialah pilihan tambahan: tugasan praktikal disemak dan dilulus secara manual oleh AHZ sebelum Sijil Teori dan Praktikal diberi. Anda memilih trek selepas teori lulus." },
      { q: "Bagaimana kalau saya perlukan bantuan?", a: "Tanya tutor dan fasilitator melalui group WhatsApp program. Pautan sesi live dimaklumkan di sana juga." },
      { q: "Mesti tonton video mengikut turutan?", a: "Disyorkan tonton mengikut turutan." },
      { q: "Bagaimana kalau kursus ini tidak sesuai dengan saya?", a: "Anda boleh memohon bayaran balik dalam {hari_refund} hari dari tarikh bayaran. Lihat bahagian Bayaran balik di atas." },
      { q: "Bagaimana saya membayar?", a: "Bayaran dibuat secara dalam talian." },
    ],
  } as Block<{ q: string; a: string }[]>,
  refundNote: {
    approved: true,
    value: [
      "Anda boleh memohon bayaran balik dalam {hari_refund} hari dari tarikh bayaran. Permohonan dibuat dalam akaun anda dan disemak secara automatik: kemajuan pembelajaran anda tidak melebihi {peratus_refund}%, anda belum menghantar apa-apa untuk disemak, dan belum membuat percubaan ujian akhir.",
      "Jika lulus semakan, sistem menyediakan surat permohonan. Anda menandatanganinya dan memuat naiknya semula. AHZ Teknik menyemak permohonan itu, dan jika diluluskan, bayaran balik dibuat melalui pindahan bank.",
      "Jumlah yang dipulangkan ialah jumlah yang anda bayar tolak {potongan} untuk kos pemprosesan bayaran.",
      "Jika permohonan anda tidak lulus semakan automatik, hubungi admin dan kes anda akan dilihat secara berasingan.",
      "Bila bayaran balik diluluskan, akses anda ditutup dan sijil yang telah dikeluarkan (jika ada) dibatalkan.",
    ],
  } as Block<string[]>,
} as const;
