// Ujian logik atribusi affiliate (B2): kod, cookie, tempoh, normalisasi emel, self-referral.
// Jalan: node scripts/test-affiliate-attrib.mjs   (tiada DB, tiada rangkaian)
import assert from "node:assert/strict";
import * as A from "../src/lib/affiliate.ts";

let fail = 0;
const t = (name, fn) => { try { fn(); console.log("lulus: " + name); } catch (e) { fail++; console.log("GAGAL: " + name + " -> " + e.message); } };

t("kod sah diterima", () => assert.equal(A.parseRefParam("AFFSATU"), "AFFSATU"));
t("kod terlalu pendek diabaikan", () => assert.equal(A.parseRefParam("ab"), null));
t("kod ada aksara pelik diabaikan", () => assert.equal(A.parseRefParam("<script>"), null));
t("kod ada ruang diabaikan", () => assert.equal(A.parseRefParam("a b c d"), null));
t("kod kosong/null diabaikan", () => { assert.equal(A.parseRefParam(null), null); assert.equal(A.parseRefParam(""), null); });

const now = 1_800_000_000;
t("cookie roundtrip", () => assert.deepEqual(A.decodeRefCookie(A.encodeRefCookie("AFFSATU", now)), { code: "AFFSATU", setAt: now }));
t("cookie rosak diabaikan", () => { assert.equal(A.decodeRefCookie("AFFSATU"), null); assert.equal(A.decodeRefCookie("x.1"), null); assert.equal(A.decodeRefCookie(undefined), null); });
t("tempoh 30 hari: hari ke-30 masih sah", () => assert.equal(A.withinWindow(now, now + 30 * 86400, 30), true));
t("tempoh 30 hari: lepas 1 saat tamat", () => assert.equal(A.withinWindow(now, now + 30 * 86400 + 1, 30), false));

t("gmail: +tag dan titik dibuang", () => assert.equal(A.normalizeEmail("Planet.Rizq+uji@Gmail.com"), "planetrizq@gmail.com"));
t("googlemail disamakan dengan gmail", () => assert.equal(A.normalizeEmail("a.b@googlemail.com"), "ab@gmail.com"));
t("domain lain: titik kekal, +tag dibuang", () => assert.equal(A.normalizeEmail("a.b+x@yahoo.com"), "a.b@yahoo.com"));

t("self-referral: alias +tag gmail ditolak", () => assert.equal(
  A.isSelfReferral({ userId: "u1", email: "planetrizq@gmail.com" }, { userId: "u2", email: "planetrizq+uji@gmail.com" }), true));
t("self-referral: user_id sama ditolak walaupun emel lain", () => assert.equal(
  A.isSelfReferral({ userId: "u1", email: "x@test.com" }, { userId: "u1", email: "y@test.com" }), true));
t("pembeli emel berbeza dibenarkan", () => assert.equal(
  A.isSelfReferral({ userId: "u3", email: "pembeli@test.com" }, { userId: "u2", email: "planetrizq+uji@gmail.com" }), false));

console.log(fail ? `\n${fail} GAGAL` : "\nSEMUA lulus");
process.exit(fail ? 1 : 0);
