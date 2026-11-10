import { createHash } from "node:crypto";

// Had gagal log masuk PER EMEL, bukan per IP: ramai pelajar kongsi satu IP (kelas face to face, Wi-Fi, CGNAT).
// ASSUMPTION: 5 gagal dalam 15 minit, kunci 15 minit. Belum disahkan Bos/Saiful.
export const LOGIN_MAX_FAILS = 5;
export const LOGIN_WINDOW_MS = 15 * 60_000;
export const LOGIN_LOCK_MS = 15 * 60_000;

export type Rekod = { failures: number; window_start: string; locked_until: string | null };

export const kunciEmel = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

// Masa (epoch ms) kunci tamat jika masih dikunci, atau null jika boleh cuba.
export function masaKunci(rekod: Rekod | null, now = Date.now()): number | null {
  if (!rekod?.locked_until) return null;
  const tamat = Date.parse(rekod.locked_until);
  return tamat > now ? tamat : null;
}

// Rekod baharu selepas satu kegagalan. Tetingkap luput ⇒ kiraan bermula semula.
export function selepasGagal(rekod: Rekod | null, now = Date.now()): Rekod {
  const dalamTetingkap = !!rekod && now - Date.parse(rekod.window_start) < LOGIN_WINDOW_MS;
  const failures = dalamTetingkap ? rekod!.failures + 1 : 1;
  const windowStart = dalamTetingkap ? rekod!.window_start : new Date(now).toISOString();
  const lock = failures >= LOGIN_MAX_FAILS;
  return {
    failures,
    window_start: windowStart,
    locked_until: lock ? new Date(now + LOGIN_LOCK_MS).toISOString() : null,
  };
}
