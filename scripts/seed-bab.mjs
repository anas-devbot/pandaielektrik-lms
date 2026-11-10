// Seed 19 bab e-book DIY Pendawaian 1 Fasa ke kursus pertama. Idempotent: bab sedia ada (course_id + position) dikemas kini tajuknya sahaja.
// Tajuk diambil daripada senarai bab e-book (docs/borang-susunan-video-AHZ.md, bahagian rujukan). Tiada video di sini: lessons dibina kemudian ikut keputusan AHZ.
// Guna: node --env-file=.env.local scripts/seed-bab.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js";

const BAB = [
  "Keselamatan Elektrik",
  "Peralatan dan Bahan Pendawaian",
  "Alat Tambah, Alat Lengkap dan Aksesori Pemasangan",
  "Jenis Sistem Pendawaian",
  "Pengagihan Bekalan Elektrik dari Tiang TNB ke Panel Meter Pengguna",
  "Sistem Satu Fasa dan Tiga Fasa",
  "Jenis, Saiz dan Kegunaan Kabel Pendawaian Rumah",
  "Litar Kawalan Pengguna dan Perlindungan",
  "Pemasangan dan Pendawaian Papan Agihan DB Satu Fasa",
  "Litar Lampu dan Suis Kawalan",
  "Pendawaian Soket",
  "Pendawaian Pemalap Lampu",
  "Pendawaian Lampu Automatik",
  "Pendawaian Kipas Siling",
  "Pendawaian Pemanas Air Mandian",
  "Pendawaian Penghawa Dingin 1 HP",
  "Lukisan Elektrik",
  "Latihan Amali Pendawaian Pelbagai",
  "Pemeriksaan dan Pengujian Pendawaian Elektrik",
];

const dry = process.argv.includes("--dry-run");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: course } = await db.from("courses").select("id, title").order("created_at").limit(1).maybeSingle();
if (!course) { console.error("Kursus tidak dijumpai. Jalankan seed kursus dahulu."); process.exit(2); }

const { data: sedia } = await db.from("chapters").select("id, position, title").eq("course_id", course.id);
const ikut = new Map((sedia ?? []).map((c) => [c.position, c]));

let tambah = 0, kemas = 0, sama = 0;
for (const [i, tajuk] of BAB.entries()) {
  const position = i + 1;
  const ada = ikut.get(position);
  if (ada && ada.title === tajuk) { sama++; continue; }
  if (ada) { kemas++; if (!dry) { const { error } = await db.from("chapters").update({ title: tajuk }).eq("id", ada.id); if (error) throw error; } continue; }
  tambah++;
  if (!dry) { const { error } = await db.from("chapters").insert({ course_id: course.id, position, title: tajuk }); if (error) throw error; }
}
console.log(`${dry ? "[dry-run] " : ""}kursus "${course.title}": ditambah ${tambah}, tajuk dikemas kini ${kemas}, sudah betul ${sama}, jumlah ${BAB.length}`);
