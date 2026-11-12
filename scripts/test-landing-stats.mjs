// Ujian tulen shapeStats (tiada DB). Jalankan: node --experimental-strip-types scripts/test-landing-stats.mjs
import assert from "node:assert/strict";
import { shapeStats, statVars, fill } from "../src/lib/landing-shape.ts";

assert.deepEqual(
  shapeStats({ lessons: 30, chapters: 19, config: { mcq_count: 40, pass_mark_mcq: 70, max_mcq_attempts: 3, access_months: 6, refund_window_days: 3, refund_progress_max_pct: 10, sla_business_days: 5, refund_deduction_sen: 500 } }),
  { videos: 30, chapters: 19, examQuestions: 40, passMarkPct: 70, maxAttempts: 3, accessMonths: 6, refundWindowDays: 3, refundProgressMaxPct: 10, slaBusinessDays: 5, refundDeductionSen: 500 },
);
const z = shapeStats({ lessons: 0, chapters: 0, config: null });
assert.equal(z.videos, 0);
for (const k of ["examQuestions", "passMarkPct", "maxAttempts", "accessMonths", "refundWindowDays", "refundProgressMaxPct", "slaBusinessDays", "refundDeductionSen"]) assert.equal(z[k], null, k);
assert.equal(shapeStats({ lessons: 1, chapters: 1, config: { mcq_count: "abc" } }).examQuestions, null);

// statVars dan fill
const rm = (sen) => `RM ${sen / 100}`;
const v = statVars(shapeStats({ lessons: 1, chapters: 1, config: { refund_window_days: 3, refund_deduction_sen: 500, sla_business_days: 5 } }), rm);
assert.equal(v.hari_refund, "3"); assert.equal(v.potongan, "RM 5"); assert.equal(v.hari_semakan, "5"); assert.equal(v.bulan_akses, null);
assert.equal(fill("Dalam {hari_refund} hari, tolak {potongan}.", v), "Dalam 3 hari, tolak RM 5.");
assert.equal(fill("Akses {bulan_akses} bulan", v), null, "nilai tiada = baris dibuang");
assert.equal(fill("Tanpa token", v), "Tanpa token");
assert.equal(statVars(shapeStats({ lessons: 1, chapters: 1, config: { refund_deduction_sen: 0 } }), rm).potongan, null, "potongan 0 = tiada ayat potongan");
console.log("test-landing-stats: OK");
