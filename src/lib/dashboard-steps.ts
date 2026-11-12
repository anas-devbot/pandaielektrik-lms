// Peta enrollments.stage -> langkah 1-7 untuk penunjuk di dashboard pelajar (paparan sahaja).
export const STEP_LABELS = [
  "Daftar dan bayar",
  "Akses bahan",
  "Belajar",
  "Ujian akhir",
  "Subjektif dan skematik",
  "Pilih sijil",
  "Sijil",
] as const;

const STAGE_STEP: Record<string, number> = {
  enrolled: 3,
  learning: 3,
  final_mcq: 4,
  part2_review: 5,
  theory_passed: 6,
  practical: 6,
  completed: 7,
};

export function stepFor(stage: string): { n: number; total: 7; label: string } {
  const n = STAGE_STEP[stage] ?? 3; // lalai sama dengan STEP.enrolled
  return { n, total: 7, label: STEP_LABELS[n - 1] };
}
