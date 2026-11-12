// Bentuk statistik landing daripada nombor mentah dan config kursus (tulen, tiada DB; diuji oleh scripts/test-landing-stats.mjs).
export type LandingStats = {
  videos: number;
  chapters: number;
  examQuestions: number | null;
  passMarkPct: number | null;
  maxAttempts: number | null;
  accessMonths: number | null;
  refundWindowDays: number | null;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function shapeStats(a: { lessons: number; chapters: number; config: Record<string, unknown> | null }): LandingStats {
  const c = a.config ?? {};
  return {
    videos: a.lessons,
    chapters: a.chapters,
    examQuestions: num(c.mcq_count),
    passMarkPct: num(c.pass_mark_mcq),
    maxAttempts: num(c.max_mcq_attempts),
    accessMonths: num(c.access_months),
    refundWindowDays: num(c.refund_window_days),
  };
}
