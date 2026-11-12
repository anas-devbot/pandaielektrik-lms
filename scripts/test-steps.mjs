// Ujian peta peringkat -> langkah 1-7 (tulen, tiada DB). Jalankan: node --experimental-strip-types scripts/test-steps.mjs
import assert from "node:assert/strict";
import { stepFor, STEP_LABELS } from "../src/lib/dashboard-steps.ts";

const cases = { enrolled: 3, learning: 3, final_mcq: 4, part2_review: 5, theory_passed: 6, practical: 6, completed: 7, xyz: 3 };
for (const [stage, n] of Object.entries(cases)) assert.equal(stepFor(stage).n, n, `${stage} -> ${n}`);
assert.equal(stepFor("final_mcq").label, "Ujian akhir");
assert.equal(stepFor("enrolled").total, 7);
assert.equal(STEP_LABELS.length, 7);
console.log("test-steps: OK");
