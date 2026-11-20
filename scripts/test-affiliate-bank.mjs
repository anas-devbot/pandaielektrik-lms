// Ujian helper butiran bank affiliate (B8a): enkripsi, kunci salah, ciphertext rosak, normalisasi akaun.
// Jalan: node scripts/test-affiliate-bank.mjs   (tiada DB, tiada rangkaian)
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import * as B from "../src/lib/affiliate-bank.ts";
import { BANK_LIST } from "../src/lib/bank-list.ts";

let fail = 0;
const t = (name, fn) => { try { fn(); console.log("lulus: " + name); } catch (e) { fail++; console.log("GAGAL: " + name + " -> " + e.message); } };
const K = randomBytes(32).toString("base64");
const K2 = randomBytes(32).toString("base64");

t("enkripsi pusingan penuh", () => {
  const enc = B.encryptAkaun("1234567890123", K);
  assert.equal(B.decryptAkaun(enc, K), "1234567890123");
  assert.ok(!enc.includes("1234567890123"), "ciphertext tak boleh mengandungi nombor asal");
});
t("IV rawak: dua enkripsi nombor sama berbeza", () => {
  assert.notEqual(B.encryptAkaun("1234567890", K), B.encryptAkaun("1234567890", K));
});
t("kunci salah ditolak", () => {
  assert.throws(() => B.decryptAkaun(B.encryptAkaun("1234567890", K), K2));
});
t("ciphertext diubah ditolak (GCM)", () => {
  const p = B.encryptAkaun("1234567890", K).split(":");
  p[3] = Buffer.from("rosak-rosak").toString("base64");
  assert.throws(() => B.decryptAkaun(p.join(":"), K));
});
t("kunci bukan 32 bait ditolak", () => {
  assert.throws(() => B.encryptAkaun("1234567890", Buffer.from("pendek").toString("base64")), /kunci_bank_tidak_sah/);
});
t("normalAkaun buang ruang dan sempang", () => assert.equal(B.normalAkaun("1234-5678 90"), "1234567890"));
t("normalAkaun tolak huruf", () => assert.equal(B.normalAkaun("12AB56789"), null));
t("normalAkaun tolak terlalu pendek", () => assert.equal(B.normalAkaun("12345"), null));
t("last4 ambil 4 digit akhir", () => assert.equal(B.last4("1234567890"), "7890"));
t("senarai bank mengandungi Maybank", () => assert.ok(BANK_LIST.includes("Maybank")));

console.log(fail ? `\n${fail} GAGAL` : "\nSEMUA lulus");
process.exit(fail ? 1 : 0);
