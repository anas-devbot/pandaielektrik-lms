// Pengawal teks landing: tiada janji/ayat terlarang, 7 langkah laluan, blok belum lulus bertanda. Jalankan: node --experimental-strip-types scripts/test-landing-content.mjs
import assert from "node:assert/strict";
import { LANDING } from "../src/content/landing.ts";

const all = JSON.stringify(LANDING).toLowerCase();
for (const w of ["gaji", "pendapatan", "layak", "jaminan kerja", "tinggal ", "slot terhad", "awak", "temu duga", "google form"]) {
  assert.ok(!all.includes(w), `teks terlarang: "${w}"`);
}
assert.equal(LANDING.journey.length, 7);
LANDING.journey.forEach((s, i) => assert.equal(s.n, i + 1));
const notFor = LANDING.notFor.join(" ").toLowerCase();
assert.ok(notFor.includes("lesen") && notFor.includes("kompetensi"), "notFor mesti sebut lesen dan kompetensi");
for (const k of ["instructor", "faq", "certificate", "refundNote"]) {
  const b = LANDING[k];
  assert.equal(b.approved, false, `${k} belum diluluskan AHZ`);
  assert.ok(JSON.stringify(b.value).includes("[Menunggu"), `${k} mesti bertanda [Menunggu`);
}
const quotes = JSON.stringify(LANDING.testimonials.value).toLowerCase();
for (const w of ["melaksanakan pendawaian", "troubleshooting", "yakin melakukan", "mampu", "boleh membuat", "tidak ada lagi was"]) {
  assert.ok(!quotes.includes(w), `petikan testimoni mengandungi dakwaan terlarang: "${w}"`);
}
assert.ok(LANDING.testimonials.value.every((t) => t.name && t.quote), "setiap petikan ada nama");
console.log("test-landing-content: OK");
