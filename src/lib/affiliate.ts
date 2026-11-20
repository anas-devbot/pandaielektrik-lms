// Logik atribusi affiliate (B2). TANPA import: boleh dijalankan terus oleh Node (scripts/test-affiliate-attrib.mjs).
// Nilai polisi (tempoh cookie, kadar) dibaca daripada courses.config di server, bukan di sini (CLAUDE.md #12).

export const REF_COOKIE = "ref";
// Had penyimpanan browser sahaja. Tempoh sebenar ditentukan config affiliate_cookie_days semasa checkout.
export const REF_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

const CODE_RE = /^[A-Za-z0-9]{4,20}$/;
const COOKIE_RE = /^([A-Za-z0-9]{4,20})\.(\d{9,11})$/;

/** Kod dari ?ref=. Tak sah → null (diabaikan senyap, pembayaran tak terjejas). */
export function parseRefParam(v: string | null | undefined): string | null {
  return v && CODE_RE.test(v) ? v : null;
}

/** Nilai cookie: "KODE.<saat epoch bila disimpan>". Cookie rosak → null. */
export function encodeRefCookie(code: string, nowSec: number): string {
  return `${code}.${nowSec}`;
}

export function decodeRefCookie(v: string | null | undefined): { code: string; setAt: number } | null {
  const m = v ? COOKIE_RE.exec(v) : null;
  return m ? { code: m[1], setAt: Number(m[2]) } : null;
}

/** Masih dalam tempoh? days dari config affiliate_cookie_days. */
export function withinWindow(setAt: number, nowSec: number, days: number): boolean {
  return nowSec - setAt <= days * 86400;
}

/**
 * Normalisasi untuk semakan self-referral: lowercase, buang +tag, dan buang titik untuk gmail/googlemail.
 * Nota: planetrizq+uji@gmail.com dan planetrizq@gmail.com menjadi SAMA (sebab itu pembeli ujian mesti emel lain).
 */
export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at).split("+")[0];
  let domain = e.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

/** Self-referral: user_id sama ATAU emel sama selepas normalisasi. */
export function isSelfReferral(
  buyer: { userId: string; email: string },
  affiliate: { userId: string; email: string },
): boolean {
  return buyer.userId === affiliate.userId || normalizeEmail(buyer.email) === normalizeEmail(affiliate.email);
}
