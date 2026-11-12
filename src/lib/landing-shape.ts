// Bentuk statistik landing daripada nombor mentah dan config kursus (tulen, tiada DB; diuji oleh scripts/test-landing-stats.mjs).
export type LandingStats = {
  videos: number;
  chapters: number;
  examQuestions: number | null;
  passMarkPct: number | null;
  maxAttempts: number | null;
  accessMonths: number | null;
  refundWindowDays: number | null;
  refundProgressMaxPct: number | null;
  slaBusinessDays: number | null;
  refundDeductionSen: number | null;
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
    refundProgressMaxPct: num(c.refund_progress_max_pct),
    slaBusinessDays: num(c.sla_business_days),
    refundDeductionSen: num(c.refund_deduction_sen),
  };
}

// Pembolehubah untuk templat teks landing ({hari_refund} dan lain-lain). null = nilai belum ada dalam config.
export type Vars = Record<string, string | null>;
export function statVars(s: LandingStats, rm: (sen: number) => string): Vars {
  const n = (v: number | null) => (v === null ? null : String(v));
  return {
    hari_refund: n(s.refundWindowDays),
    peratus_refund: n(s.refundProgressMaxPct),
    bulan_akses: n(s.accessMonths),
    soalan_ujian: n(s.examQuestions),
    markah_lulus: n(s.passMarkPct),
    had_percubaan: n(s.maxAttempts),
    hari_semakan: n(s.slaBusinessDays),
    potongan: s.refundDeductionSen && s.refundDeductionSen > 0 ? rm(s.refundDeductionSen) : null, // 0/tiada = tiada potongan, ayat dibuang
  };
}

// Isi templat. Jika mana-mana {kunci} tiada nilai, pulangkan null supaya baris itu dibuang (tidak memaparkan "{...}" atau angka tekaan).
export function fill(t: string, vars: Vars): string | null {
  let missing = false;
  const out = t.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === null || v === undefined) { missing = true; return ""; }
    return v;
  });
  return missing ? null : out;
}
