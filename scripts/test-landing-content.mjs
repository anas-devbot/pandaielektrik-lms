// Pengawal teks landing: tiada janji/ayat terlarang, 7 langkah laluan, blok belum lulus bertanda. Jalankan: node --experimental-strip-types scripts/test-landing-content.mjs
import assert from "node:assert/strict";
import { LANDING } from "../src/content/landing.ts";
import { statVars, shapeStats, fill } from "../src/lib/landing-shape.ts";

const all = JSON.stringify(LANDING).toLowerCase();
for (const w of ["gaji", "pendapatan", "layak", "jaminan kerja", "tinggal ", "slot terhad", "awak", "temu duga", "google form"]) {
  assert.ok(!all.includes(w), `teks terlarang: "${w}"`);
}
assert.equal(LANDING.journey.length, 7);
LANDING.journey.forEach((s, i) => assert.equal(s.n, i + 1));
const notFor = LANDING.notFor.join(" ").toLowerCase();
assert.ok(notFor.includes("lesen") && notFor.includes("kompetensi"), "notFor mesti sebut lesen dan kompetensi");
const ins = LANDING.instructor;
assert.equal(ins.approved, true);
assert.equal(ins.value.stats.length, 3);
assert.ok(ins.value.paragraphs.length === 4 && !JSON.stringify(ins.value).includes("[Menunggu"), "bio pengajar lengkap");
const quotes = JSON.stringify(LANDING.testimonials.value).toLowerCase();
for (const w of ["melaksanakan pendawaian", "troubleshooting", "yakin melakukan", "mampu", "boleh membuat", "tidak ada lagi was"]) {
  assert.ok(!quotes.includes(w), `petikan testimoni mengandungi dakwaan terlarang: "${w}"`);
}
assert.ok(LANDING.testimonials.value.every((t) => t.name && t.quote), "setiap petikan ada nama");
assert.ok(!("certificate" in LANDING), "contoh sijil dikeluarkan daripada landing (keputusan Bos 13 Nov)");

// Templat: setiap {token} ada dalam statVars; dengan config penuh tiada baris dibuang dan tiada "{" tinggal.
const full = shapeStats({ lessons: 30, chapters: 19, config: { mcq_count: 40, pass_mark_mcq: 70, max_mcq_attempts: 3, access_months: 6, refund_window_days: 3, refund_progress_max_pct: 10, sla_business_days: 5, refund_deduction_sen: 500 } });
const vars = statVars(full, (sen) => `RM ${sen / 100}`);
const texts = [...LANDING.faq.value.flatMap((f) => [f.q, f.a]), ...LANDING.refundNote.value];
for (const x of texts) {
  for (const m of x.matchAll(/\{(\w+)\}/g)) assert.ok(m[1] in vars, `token tidak dikenali: {${m[1]}}`);
  const f = fill(x, vars);
  assert.ok(f !== null && !f.includes("{"), `templat tidak lengkap: ${x.slice(0, 40)}`);
}
assert.equal(LANDING.faq.value.length, 10);
assert.ok(fill(LANDING.refundNote.value[2], vars).includes("RM 5"), "ayat potongan RM5 dari config");
// Config tanpa potongan: ayat potongan dibuang, selebihnya kekal.
const noDed = statVars(shapeStats({ lessons: 1, chapters: 1, config: { refund_window_days: 3, refund_progress_max_pct: 10 } }), () => "");
assert.equal(fill(LANDING.refundNote.value[2], noDed), null);
assert.ok(fill(LANDING.refundNote.value[0], noDed) !== null);
console.log("test-landing-content: OK");
