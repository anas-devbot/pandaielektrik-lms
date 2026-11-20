// Butiran bank affiliate (B8a). Enkripsi AES-256-GCM untuk nombor akaun sahaja. Kunci dihantar oleh pemanggil (dari env server).
// Tiada import Next: boleh diuji terus dengan Node (scripts/test-affiliate-bank.mjs).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// ASSUMPTION: senarai bank ringkas (bank komersial/Islam/koperasi utama). Semak dengan AHZ sebelum launch.
export const BANK_LIST = [
  "Affin Bank", "Agrobank", "Alliance Bank", "AmBank", "Bank Islam", "Bank Muamalat", "Bank Rakyat",
  "Bank Simpanan Nasional (BSN)", "CIMB Bank", "Hong Leong Bank", "HSBC Bank Malaysia", "Maybank",
  "OCBC Bank (Malaysia)", "Public Bank", "RHB Bank", "Standard Chartered Malaysia", "UOB Malaysia",
] as const;

/** Nombor akaun: buang ruang dan sempang. Hanya digit, 6 hingga 20. Tak sah → null. */
export function normalAkaun(v: string): string | null {
  const d = v.replace(/[\s-]/g, "");
  return /^\d{6,20}$/.test(d) ? d : null;
}

/** 4 digit akhir sahaja untuk paparan. */
export function last4(akaun: string): string {
  return akaun.slice(-4);
}

/** Kunci 32 bait dalam base64. Tak sah → ralat (jangan teruskan tanpa kunci). */
function kunci(keyB64: string): Buffer {
  const k = Buffer.from(keyB64, "base64");
  if (k.length !== 32) throw new Error("kunci_bank_tidak_sah");
  return k;
}

export function encryptAkaun(akaun: string, keyB64: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kunci(keyB64), iv);
  const data = Buffer.concat([c.update(akaun, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptAkaun(enc: string, keyB64: string): string {
  const [ver, iv, tag, data] = enc.split(":");
  if (ver !== "v1" || !iv || !tag || !data) throw new Error("format_bank_tidak_sah");
  const d = createDecipheriv("aes-256-gcm", kunci(keyB64), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
