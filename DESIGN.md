# Design System — pandaielektrik (LMS Kursus DIY Pendawaian Elektrik 1 Fasa)

Status: **Diluluskan Bos (12 Nov 2026) berdasarkan pratonton.** Nilai token di bawah belum diterapkan dalam `src/app/globals.css`. Penerapan dibuat dalam PR berasingan.

## Product Context
- **What this is:** LMS kursus elektrik self-paced untuk AHZ Teknik Enterprise. Pelajar belajar video, lulus ujian, dan dapat sijil pencapaian.
- **Who it's for:** pelajar Malaysia dewasa, kebanyakannya guna telefon. Sebahagian besar kursus dalam Bahasa Melayu.
- **Space/industry:** kursus pendawaian elektrik. Pesaing tempatan biasanya dijalankan di pusat berakreditasi, bukan online penuh.
- **Project type:** web app (landing, daftar, beli, dashboard, belajar, ujian, sijil).

## Memorable Thing
Serius dan boleh dipercayai. Ia rasa seperti kursus rasmi, bukan kelas main-main.

## Aesthetic Direction
- **Direction:** formal-kemas. Grid tegas, hierarki taip jelas, banyak ruang putih.
- **Decoration level:** minimal. Garis emas nipis di tajuk halaman. Bingkai emas hanya pada sijil.
- **Mood:** tenang, berkeyakinan, dan jelas. Setiap langkah seterusnya mesti mudah dikesan.
- **Reference:** kertas kerja sijil AHZ (`CONTOH SIJIL/baru-upload/`) untuk warna dan susunan.
- **Logo:** maskot pendawai (kepala dan topi sahaja, dipotong bulat) untuk favicon dan ikon app. Percikan api dan kabel tidak digunakan dalam ikon.

## Typography
- **Display/Hero:** Fraunces (semi-bold 600, bold 700 untuk harga dan sijil). Serif untuk tajuk, sama dengan sijil. Risiko yang diterima.
- **Body:** Source Sans 3 (400, 600, 700). Mudah dibaca untuk perenggan BM dan borang.
- **UI/Labels:** Source Sans 3 (600).
- **Data/Tables:** Source Sans 3 dengan `font-variant-numeric: tabular-nums` untuk harga, tarikh, dan markah.
- **Code:** tiada keperluan semasa. Jika perlu, guna monospace sistem.
- **Loading:** `next/font/google` dalam app, supaya tiada permintaan ke pihak ketiga semasa runtime.
- **Scale (asas 16px):** xs 12, sm 14, base 16, lg 18, xl 20, 2xl 24, 3xl 30, 4xl 36 (desktop sehingga 48). Baris badan 1.6, tajuk 1.2.

## Color
- **Approach:** restrained. Satu aksen (emas) dan neutral. Warna semantik hanya untuk status.
- **Ink (primary):** `#161616`. Teks utama, butang utama.
- **Paper (background):** `#FAF9F6`. Latar halaman.
- **Surface:** `#FFFFFF`. Kad, borang.
- **Border:** `#E5E2DA`.
- **Muted text:** `#5C5A55`.
- **Gold text:** `#8A6A00` (5:1 atas putih). Untuk pautan dan teks aksen kecil sahaja.
- **Gold decorative:** `#C9A227`. Garis hiasan sahaja. Jangan guna untuk teks.
- **Semantic:** success `#1E7B4F`, warning `#9A5B00`, error `#B42318`, info `#1D4ED8`.
- **Dark mode:** latar `#121212`, permukaan `#1C1C1C`, border `#2E2C28`, teks `#F2F0EA`, muted `#A8A49B`, emas `#D4B04A`. Kurangkan ketepuan warna status 10 hingga 20%.

## Spacing
- **Base unit:** 4px
- **Density:** comfortable
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)
- **Tepi halaman (telefon):** 16px

## Layout
- **Approach:** grid-disciplined. Susunan boleh dijangka.
- **Grid:** 1 kolum telefon, 2 kolum dari 720px, 3 kolum untuk kad status.
- **Max content width:** 960px (app). 720px untuk teks bab dan terma.
- **Border radius:** sm 4px (sijil), md 6px (butang, input), lg 8px (kad). Pil (999px) hanya untuk chip status.

## Motion
- **Approach:** minimal-functional. Hanya transisi keadaan.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(100ms) short(150-200ms). Tiada animasi hiasan.
- **Reduced motion:** hormat `prefers-reduced-motion`.

## Elak
- Warna ungu dan gradient sebagai default.
- Grid 3 kolum dengan ikon dalam bulatan berwarna.
- Semua elemen dengan radius sama besar.
- `Inter`, `Roboto`, `Arial`, `system-ui` sebagai font utama.
- Maskot dalam halaman sijil, bayar, atau terma.

## Decisions Log
| Tarikh | Keputusan | Sebab |
|---|---|---|
| 12 Nov 2026 | Sistem reka bentuk awal diluluskan Bos berdasarkan pratonton | Formal-kemas, serif untuk tajuk, emas dari sijil |
| 12 Nov 2026 | SLA pilihan A dipaparkan sebelum bayar | Keputusan Bos (DRAF-teks-AHZ seksyen 7) |
| 12 Nov 2026 | Ikon dari kepala dan topi maskot sahaja | Elak imej kabel dan percikan dalam ikon |
