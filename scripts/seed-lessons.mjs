// Seed video (lessons) dari playlist YouTube AHZ: Volume 1 (PLS5Ke8GDLXt8) dan Volume 2 (PLUN3RDuu709U), plus 2 video pengenalan dari docs/video-youtube.csv.
// PEMETAAN BAB = CADANGAN (docs/video-youtube.csv, lajur bab_ebook_cadangan). Belum disahkan AHZ (docs/borang-susunan-video-AHZ.md).
// Duplikat dan turutan akhir masih keputusan AHZ: kemas kini lessons.chapter_id / position terus, atau padam dan jalankan semula.
// Idempotent: video_ref sedia ada dilangkau. Guna: node --env-file=.env.local scripts/seed-lessons.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js";

// [video_id, bab (position), tajuk, saat]. Turutan dalam setiap bab = turutan dalam senarai ini.
const VIDEO = [
  ["a3sLJ6QJ4sw", 1, "PENGENALAN KURSUS 2", 109],
  ["FBR7_NUTEHY", 1, "PENGENALAN KURSUS DIY ELEKTRIK 1 FASA", 61],
  ["LwpXHIT6Nco", 1, "Video Silibus Pendawaian & Penyelenggaran Elektrik VS", 411],
  ["o71S5otS4e8", 1, "Video Keselamatan 01 VK01", 281],
  ["HEPCf321uCc", 2, "Video Peralatan VP01", 429],
  ["DtljHrHi-qI", 2, "PERALATAN TANGAN", 325],
  ["tTIfbBDqykc", 2, "V02-013 PERALATAN PENDAWAIAN", 264],
  ["OUc8sdZmusA", 4, "Video Pengenalan Pendawaian Elektrik VP01", 363],
  ["xSiKXSC7dws", 4, "Video Pengenalan Pendawaian Elektrik VP02", 309],
  ["5e5b_sdKbx8", 5, "VIDEO PENGENALAN SUMBER BEKALAN DI RUMAH VP01", 285],
  ["5gwwZvcbQsw", 5, "Panel Meter 1 FASA", 116],
  ["O_ejD2kTk0Q", 5, "Panel Meter VPM", 115],
  ["5KQ20UKyOyg", 5, "BEKALAN TNB KE RUMAH KEDIAMAN", 364],
  ["CuXC_0qM9vM", 6, "PART 3 ASAS ELEKTRIK 1 FASA", 510],
  ["_aVaMfMg-qo", 6, "PART 2 ASAS ELEKTRIK 1 FASA", 901],
  ["Nb209OBnp68", 6, "PART 1 ASAS ELEKTRIK 1 FASA", 901],
  ["1eHysGG1NGU", 7, "JENIS JENIS KABEL DAN ALAT TAMBAH", 316],
  ["riJfoKxkVdc", 7, "JENIS JENIS KABEL DAN ALAT TAMBAH (Vol 2)", 316],
  ["ZGWe2aGzQAw", 9, "DB 1 Fasa VDB part 1", 289],
  ["cfzPPHfdN-4", 9, "DB 1 Fasa VDB part 2", 86],
  ["E5YVTn7Jkl4", 9, "pengenalan db 1 fasa", 340],
  ["BgEbcQHeLF0", 9, "PENGENALAN DAN FUNGSI DB", 316],
  ["EyD9YVEWi2Y", 9, "SUSUNAN DAN PENDAWAIAN DALAM DB", 429],
  ["diEbYFE6Mhc", 9, "PEMASANGAN DB 3 FASA (bab cadangan: tiada dalam e-book 1 fasa)", 207],
  ["5YCoCNltDhY", 17, "TRACING KABEL UNTUK MELUKIS SKEMATIK DAN LAYOUT RUMAH", 318],
  ["NLSsKujW_48", 18, "Membuat Papan bay di rumah", 347],
  ["Pe6XEhhp-Y8", 18, "V02-012 Cara buat bay", 679],
  ["U4fNE83Ewbc", 18, "KAEDAH MENCARI KABEL YANG TIDAK DIMARKING", 262],
  ["1CxtVb1cXfY", 18, "MENCARI KABEL YANG TIADA MARKING", 109],
  ["6vnkbwyFN7U", 19, "BAGAIMANA PENGGUNAAN DIGITAL CLAMP METER", 227],
];

const dry = process.argv.includes("--dry-run");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: course } = await db.from("courses").select("id").order("created_at").limit(1).maybeSingle();
const { data: bab } = await db.from("chapters").select("id, position").eq("course_id", course.id);
const idBab = new Map(bab.map((c) => [c.position, c.id]));
const { data: sedia } = await db.from("lessons").select("video_ref, chapter_id, position").eq("course_id", course.id);
const adaRef = new Set(sedia.map((l) => l.video_ref));
const seterusnya = new Map(); // bab → posisi seterusnya
for (const l of sedia) seterusnya.set(l.chapter_id, Math.max(seterusnya.get(l.chapter_id) ?? 0, l.position));

let tambah = 0, lepas = 0;
for (const [videoId, posBab, tajuk, saat] of VIDEO) {
  if (adaRef.has(videoId)) { lepas++; continue; }
  const chapterId = idBab.get(posBab);
  if (!chapterId) throw new Error(`bab ${posBab} tiada dalam DB`);
  const position = (seterusnya.get(chapterId) ?? 0) + 1;
  seterusnya.set(chapterId, position);
  tambah++;
  if (dry) continue;
  const { error } = await db.from("lessons").insert({ course_id: course.id, chapter_id: chapterId, position, title: tajuk, video_provider: "youtube", video_ref: videoId, duration_seconds: saat });
  if (error) throw error;
}
console.log(`${dry ? "[dry-run] " : ""}video ditambah ${tambah}, dilangkau (sudah ada) ${lepas}, jumlah senarai ${VIDEO.length}`);
