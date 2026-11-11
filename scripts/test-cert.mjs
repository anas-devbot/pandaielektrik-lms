// Ujian e2e slice 8: PDF sijil, halaman semakan awam, kawalan akses. Perlu app berjalan (BASE_URL, default :3101) + Supabase LOCAL.
// Guna: node --env-file=.env.local scripts/test-cert.mjs [--keep]    Bersihkan: supabase/tests/cleanup-cert-data.sql
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import jsQR from "jsqr";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101", PW = "UjiLocal-Cert-4kQz", KEEP = process.argv.includes("--keep");
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };

const mk = async (n, role) => {
  if (role) await db.from("staff_invites").insert({ email: `ct-${n}@test.local`, role });
  return (await db.auth.admin.createUser({ email: `ct-${n}@test.local`, password: PW, email_confirm: true, user_metadata: { privacy_accepted: true, phone: "0123456789", full_name: `Ujian Sijil ${n}` } })).data.user;
};
const [S, S2, ADM] = [await mk("s1"), await mk("s2"), await mk("adm", "admin")];
const { data: course } = await db.from("courses").select("id, config").order("created_at").limit(1).single();
const far = new Date(Date.now() + 90 * 864e5).toISOString();
const enr = async (u, stage) => (await db.from("enrollments").insert({ user_id: u.id, course_id: course.id, stage, access_ends_at: far }).select("id").single()).data;
const eS = await enr(S, "theory_passed"); await enr(S2, "enrolled");
const approved = (v) => db.from("courses").update({ config: { ...course.config, certificate: { ...course.config.certificate, wording_approved: v } } }).eq("id", course.id);

async function cookieFor(email) {
  const jar = new Map();
  const sb = createServerClient(URL_, KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PW }); if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const get = async (p, c) => { const r = await fetch(BASE + p, { redirect: "manual", headers: c ? { cookie: c } : {} }); const ct = r.headers.get("content-type") ?? ""; return { s: r.status, ct, cd: r.headers.get("content-disposition") ?? "", cc: r.headers.get("cache-control") ?? "", buf: Buffer.from(await r.arrayBuffer()) }; };
const [cS, cS2, cA] = await Promise.all([S, S2, ADM].map((u) => cookieFor(u.email)));
const pdfText = (buf) => { const d = mkdtempSync(path.join(tmpdir(), "cert-")); const f = path.join(d, "c.pdf"); writeFileSync(f, buf); return { text: execFileSync("pdftotext", ["-raw", f, "-"]).toString(), file: f }; };

try {
  await approved(false);
  await db.rpc("choose_track", { p_enrollment: eS.id, p_track: "theory" });
  const { data: certId } = await db.rpc("issue_certificate", { p_enrollment: eS.id, p_type: "theory", p_holder_name: "Ali Bin Abu Bakar" });
  const { data: cert } = await db.from("certificates").select("*").eq("id", certId).single();

  let r = await get(`/api/sijil/${certId}`); ok(r.s === 401, "PDF tanpa log masuk = 401");
  r = await get(`/api/sijil/${certId}`, cS2); ok(r.s === 404, "pelajar lain: 404");
  r = await get(`/api/sijil/${certId}`, cS);
  ok(r.s === 200 && r.ct === "application/pdf" && r.buf.subarray(0, 5).toString() === "%PDF-", "pemilik: PDF sah");
  ok(r.cd.includes(`${cert.cert_id}.pdf`) && r.cc.includes("no-store"), "nama fail = ID sijil, tidak di-cache");
  let { text, file } = pdfText(r.buf);
  ok(text.includes("ALI BIN ABU BAKAR"), "PDF: nama (huruf besar)");
  ok(text.includes(cert.cert_id), "PDF: ID sijil");
  ok(text.includes("SIJIL PENCAPAIAN TEORI"), "PDF: tajuk daripada config");
  ok(/\d{1,2}\/\d{1,2}\/\d{4} - \d{1,2}\/\d{1,2}\/\d{4}/.test(text), "PDF: tempoh format d/m/yyyy");
  ok(text.includes("AHZ TEKNIK ENTERPRISE") && text.includes("Nilai, Negeri Sembilan") && text.includes("Pengarah Latihan"), "PDF: organisasi, alamat, jawatan penandatangan");
  ok(text.includes("bukan perakuan kekompetenan"), "PDF: penafian bukan sijil kompetensi");
  ok(text.includes("DRAF"), "PDF: penanda air DRAF selagi wording belum diluluskan");
  ok(!/no\.? ?k[ap]|kad pengenalan|\bic\b/i.test(text), "PDF: tiada medan No. KP");
  const img = execFileSync("pdfimages", ["-list", file]).toString(); ok(img.split("\n").filter((l) => /image/.test(l)).length >= 2, "PDF: logo dan kod QR dibenamkan");
  execFileSync("pdftoppm", ["-r", "200", "-png", "-singlefile", file, file.replace(".pdf", "")]);
  const { data: px, info } = await sharp(file.replace(".pdf", ".png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const qr = jsQR(new Uint8ClampedArray(px), info.width, info.height);
  ok(qr?.data === `${process.env.NEXT_PUBLIC_SITE_URL}/semak/${cert.verify_token}`, "kod QR dibaca = URL semakan awam yang betul");
  r = await get(`/api/sijil/${certId}`, cA); ok(r.s === 200, "admin boleh muat turun");

  await approved(true);
  r = await get(`/api/sijil/${certId}`, cS); ({ text } = pdfText(r.buf)); ok(!text.includes("DRAF"), "PDF: DRAF hilang bila wording diluluskan");
  await approved(false);

  // semakan awam
  r = await get(`/semak/${cert.verify_token}`);
  let t = r.buf.toString();
  ok(r.s === 200 && t.includes("Sijil ini SAH") && t.includes("ALI BIN ABU BAKAR") && t.includes(cert.cert_id), "semakan awam (tanpa log masuk): SAH, nama, ID");
  ok(!/@test\.local|ct-s1|user_id|enrollment/i.test(t), "semakan awam: tiada emel/ID dalaman");
  ok(/noindex/.test(t), "semakan awam: noindex");
  r = await get(`/semak/${"0".repeat(32)}`); ok(r.s === 404, "token tak wujud = 404");
  r = await get(`/semak/bukan-token`); ok(r.s === 404, "token tak sah format = 404");

  // dashboard
  r = await get("/dashboard", cS); t = r.buf.toString();
  ok(t.includes(`/api/sijil/${certId}`) && t.includes(`/semak/${cert.verify_token}`) && !t.includes("Keluarkan sijil"), "dashboard: pautan muat turun + semakan, tiada borang");
  r = await get("/dashboard", cS2); ok(!r.buf.toString().includes("Keluarkan sijil"), "dashboard pelajar belum layak: tiada borang sijil");

  // Sijil Teori & Praktikal (slice 10)
  const S3 = await mk("s3"); const eS3 = await enr(S3, "practical"); await db.from("enrollments").update({ cert_track: "theory_practical", practical_result: "lulus" }).eq("id", eS3.id);
  const cS3 = await cookieFor(S3.email);
  r = await get("/dashboard", cS3); t = r.buf.toString();
  ok(t.includes("Praktikal lulus. Anda boleh mengeluarkan Sijil Teori dan Praktikal") && t.includes('name="name"'), "dashboard (trek praktikal, praktikal lulus): borang sijil teori & praktikal");
  const { data: pc } = await db.rpc("issue_certificate", { p_enrollment: eS3.id, p_type: "theory_practical", p_holder_name: "Siti Binti Ahmad" });
  r = await get(`/api/sijil/${pc}`, cS3); ({ text } = pdfText(r.buf));
  ok(r.s === 200 && text.replace(/\s+/g, " ").includes("SIJIL LULUS UJIAN TEORI & PRAKTIKAL") && text.includes("SITI BINTI AHMAD"), "PDF teori & praktikal: tajuk (2 baris) dan nama");
  ok(text.includes("Telah Menyertai Dan Lulus Ujian Dengan Jayanya"), "PDF teori & praktikal: ayat pencapaian daripada config");
  const { data: pcert } = await db.from("certificates").select("verify_token").eq("id", pc).single();
  r = await get(`/semak/${pcert.verify_token}`); ok(r.buf.toString().includes("Sijil teori dan praktikal") && r.buf.toString().includes("Sijil ini SAH"), "semakan awam: jenis teori dan praktikal, SAH");
  r = await get("/dashboard", cS3); ok(r.buf.toString().includes("Sijil teori dan praktikal") && r.buf.toString().includes(`/api/sijil/${pc}`), "dashboard: sijil teori dan praktikal + muat turun");
  r = await get(`/api/sijil/${pc}`, cS); ok(r.s === 404, "sijil praktikal: pelajar lain 404");

  // batal
  await db.rpc("revoke_certificate", { p_actor: ADM.id, p_certificate: certId, p_reason: "ujian" });
  r = await get(`/api/sijil/${certId}`, cS); ok(r.s === 410, "sijil dibatalkan: muat turun = 410");
  r = await get(`/semak/${cert.verify_token}`); t = r.buf.toString(); ok(t.includes("TELAH DIBATALKAN"), "semakan awam: DIBATALKAN");
  r = await get("/dashboard", cS); t = r.buf.toString(); ok(t.includes("Keluarkan sijil") && t.includes('name="name"'), "dashboard: selepas batal borang keluarkan semula muncul");
} finally {
  console.log(KEEP ? "data ditinggalkan (--keep)" : "bersihkan: supabase/tests/cleanup-cert-data.sql");
}
console.log(JSON.stringify({ student: S.email, password: PW }));
console.log(fail ? `${fail} GAGAL` : "semua lulus"); process.exit(fail ? 1 : 0);
