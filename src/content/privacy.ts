// Notis privasi: MESTI disemak dan diluluskan AHZ Teknik sebelum pelajar sebenar mendaftar (CLAUDE.md bahagian 13/14).
// Naikkan PRIVACY_VERSION setiap kali teks berubah (tanpa itu, rekod persetujuan lama tak tepat).
export const PRIVACY_VERSION = "draf-3";

export const PRIVACY_NOTICE = {
  title: "NOTIS PRIVASI DAN PERLINDUNGAN DATA PESERTA",
  org: "AHZ Teknik",
  intro:
    "AHZ Teknik komited untuk melindungi privasi dan maklumat peribadi setiap peserta kursus. Maklumat yang dikumpulkan akan digunakan bagi tujuan pengurusan kursus, penilaian dan penambahbaikan perkhidmatan seperti berikut:",
  sections: [
    {
      heading: "1. Pengumpulan Maklumat",
      paragraphs: [
        "Kami mengumpul nama penuh, alamat e-mel dan nombor telefon bimbit bagi tujuan pendaftaran akaun, pengurusan pembayaran, penyediaan sijil serta pengesahan identiti peserta semasa menyertai kumpulan WhatsApp atau Telegram kursus.",
      ],
    },
    {
      heading: "2. Maklumat Tambahan",
      paragraphs: [
        "Maklumat seperti negeri, daerah, jantina dan julat umur adalah pilihan dan maklumat ini digunakan untuk pelaporan kursus serta membantu AHZ Teknik menambah baik kandungan dan kaedah penyampaian latihan.",
      ],
    },
    {
      heading: "3. Kerahsiaan Tugasan dan Penilaian",
      paragraphs: [
        "Semua tugasan dan bahan yang dihantar, termasuk jawapan subjektif, lukisan skematik dan borang penilaian, hanya boleh diakses oleh pasukan penilai AHZ Teknik bagi tujuan semakan dan penilaian kursus.",
      ],
    },
    {
      heading: "4. Paparan Sijil",
      paragraphs: [
        "Halaman semakan sijil awam hanya memaparkan nama peserta, tajuk kursus, tarikh pengeluaran dan status sijil. Maklumat peribadi lain tidak akan dipaparkan pada halaman tersebut.",
      ],
    },
    {
      heading: "5. Penghantaran Video Trek Praktikal",
      paragraphs: [
        "Bagi peserta yang memilih trek praktikal, video pengujian perlu dihantar melalui kumpulan Telegram yang turut disertai peserta lain. Oleh itu, semua ahli kumpulan boleh melihat video yang dihantar.",
        "Peserta perlu memahami bahawa video dan mesej yang telah dihantar mungkin kekal dalam sejarah perbualan walaupun peserta meninggalkan kumpulan atau dikeluarkan daripada kumpulan tersebut. Peringatan dan persetujuan khusus akan diminta sebelum sebarang video dihantar.",
      ],
    },
    {
      heading: "6. Perlindungan Maklumat",
      paragraphs: [
        "AHZ Teknik akan mengambil langkah yang munasabah untuk melindungi maklumat peserta daripada akses, penggunaan atau pendedahan tanpa kebenaran. Maklumat hanya digunakan bagi tujuan yang dinyatakan dalam notis ini, tertakluk kepada keperluan operasi dan undang-undang yang berkenaan.",
      ],
    },
  ],
  closing: [
    "Dengan meneruskan pendaftaran, anda mengesahkan bahawa anda telah membaca dan memahami Notis Privasi ini.",
    "AHZ Teknik berhak mengemas kini notis ini dari semasa ke semasa sekiranya perlu.",
  ],
} as const;
