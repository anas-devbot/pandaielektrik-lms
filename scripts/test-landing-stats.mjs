// Ujian tulen shapeStats (tiada DB). Jalankan: node --experimental-strip-types scripts/test-landing-stats.mjs
import assert from "node:assert/strict";
import { shapeStats } from "../src/lib/landing-shape.ts";

assert.deepEqual(
  shapeStats({ lessons: 30, chapters: 19, config: { mcq_count: 40, pass_mark_mcq: 70, max_mcq_attempts: 3, access_months: 6, refund_window_days: 3 } }),
  { videos: 30, chapters: 19, examQuestions: 40, passMarkPct: 70, maxAttempts: 3, accessMonths: 6, refundWindowDays: 3 },
);
const z = shapeStats({ lessons: 0, chapters: 0, config: null });
assert.equal(z.videos, 0);
for (const k of ["examQuestions", "passMarkPct", "maxAttempts", "accessMonths", "refundWindowDays"]) assert.equal(z[k], null, k);
assert.equal(shapeStats({ lessons: 1, chapters: 1, config: { mcq_count: "abc" } }).examQuestions, null);
console.log("test-landing-stats: OK");
