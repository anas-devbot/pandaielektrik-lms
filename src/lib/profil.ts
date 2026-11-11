// Maklumat pilihan pada profil. Semua medan boleh dibiarkan kosong (null).
// Nilai di sini mesti sepadan dengan CHECK constraint dalam migration 20261113000001_profil_demografi.sql.

export const NEGERI = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Pulau Pinang", "Perak",
  "Perlis", "Selangor", "Terengganu", "Sabah", "Sarawak",
  "Wilayah Persekutuan Kuala Lumpur", "Wilayah Persekutuan Labuan", "Wilayah Persekutuan Putrajaya",
] as const;

export const JANTINA = [
  { nilai: "lelaki", label: "Lelaki" },
  { nilai: "perempuan", label: "Perempuan" },
] as const;

export const JULAT_UMUR = [
  { nilai: "bawah-18", label: "Bawah 18" },
  { nilai: "18-24", label: "18 hingga 24" },
  { nilai: "25-34", label: "25 hingga 34" },
  { nilai: "35-44", label: "35 hingga 44" },
  { nilai: "45-54", label: "45 hingga 54" },
  { nilai: "55+", label: "55 ke atas" },
] as const;

const CORAK_DAERAH = /^\p{L}[\p{L}'.\- ]*$/u;
const CORAK_TELEFON = /^01[0-9]{8,9}$/;

/** Kosong → null. Pilihan dalam borang dihantar sebagai rentetan kosong. */
export function nilaiPilihan(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

/** Terima 012-345 6789, +60 12 3456789, 0123456789. Pulang format 01xxxxxxxx(x) atau null. */
export function normalTelefon(v: string | null): string | null {
  if (v === null) return null;
  const t = v.replace(/[\s-]/g, "").replace(/^\+?60/, "0");
  return t === "" ? null : t;
}

/** Telefon WAJIB untuk pelajar. Pulang mesej ralat atau null. */
export function periksaTelefon(t: string | null): string | null {
  if (t === null) return "Sila isi nombor telefon.";
  return CORAK_TELEFON.test(t) ? null : "Nombor telefon tidak sah (contoh: 012-3456789).";
}

/** Daerah ialah teks bebas (pilihan). Pulang mesej ralat atau null. */
export function periksaDaerah(d: string | null): string | null {
  if (d === null) return null;
  const bersih = d.replace(/\s+/g, " ");
  if (bersih.length < 2 || bersih.length > 60) return "Daerah mesti 2 hingga 60 aksara.";
  if (!CORAK_DAERAH.test(bersih)) return "Daerah hanya boleh ada huruf, ruang, titik, sempang dan apostrof.";
  return null;
}

export function periksaPilihan(v: string | null, senarai: readonly string[], ralat: string): string | null {
  if (v === null) return null;
  return senarai.includes(v) ? null : ralat;
}
