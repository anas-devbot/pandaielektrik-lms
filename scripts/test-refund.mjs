// Ujian e2e slice 11 (HTTP): halaman refund, surat PDF, kawalan akses, penutupan akses. Perlu app (BASE_URL :3101) + Supabase LOCAL.
// Mula app: STORAGE_DRIVER=local npx next dev -H 127.0.0.1 -p 3101    Bersihkan: supabase/tests/cleanup-refund-data.sql
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101", PW = "UjiLocal-Refund-5xQz";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };
const tag = Math.random().toString(36).slice(2, 6).toUpperCase();

const mk = async (n, role) => {
  if (role) await db.from("staff_invites").insert({ email: `rf-${n}@test.local`, role });
  return (await db.auth.admin.createUser({ email: `rf-${n}@test.local`, password: PW, email_confirm: true, user_metadata: { privacy_accepted: true, phone: "0123456789", full_name: `Ujian Refund ${n}` } })).data.user;
};
const [S1, S2, S3, S4, ADM] = [await mk("s1"), await mk("s2"), await mk("s3"), await mk("s4"), await mk("adm", "admin")];
const { data: course } = await db.from("courses").select("id, price, currency").order("created_at").limit(1).single();
const far = new Date(Date.now() + 150 * 864e5).toISOString();
async function enr(u, paidAgoMs, orderless) {
  let oid = null;
  if (!orderless) {
    const paid = new Date(Date.now() - paidAgoMs).toISOString();
    oid = (await db.from("orders").insert({ user_id: u.id, course_id: course.id, order_number: `RF${tag}${u.email.slice(3, 5).toUpperCase()}`, amount: course.price, currency: course.currency, status: "paid", paid_at: paid, terms_accepted_at: paid }).select("id").single()).data.id;
  }
  return (await db.from("enrollments").insert({ user_id: u.id, course_id: course.id, order_id: oid, access_ends_at: far }).select("id").single()).data;
}
const eS1 = await enr(S1, 3600e3), eS2 = await enr(S2, 3600e3); await enr(S3, 5 * 864e5); await enr(S4, 0, true);
await db.from("submissions").insert({ course_id: course.id, enrollment_id: eS2.id, type: "subjective", text_answer: "x", source: "lms", status: "pending" });   // S2 gagal semakan

async function cookieFor(email) {
  const jar = new Map();
  const sb = createServerClient(URL_, KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PW }); if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const get = async (p, c) => { const r = await fetch(BASE + p, { redirect: "manual", headers: c ? { cookie: c } : {} }); const ct = r.headers.get("content-type") ?? ""; const buf = Buffer.from(await r.arrayBuffer()); return { s: r.status, ct, buf, t: /pdf|image/.test(ct) ? "" : buf.toString().replace(/<!-- -->/g, "") }; };
const [c1, c2, c3, c4, cA] = await Promise.all([S1, S2, S3, S4, ADM].map((u) => cookieFor(u.email)));
const pdfText = (buf) => { const d = mkdtempSync(path.join(tmpdir(), "rf-")); const f = path.join(d, "s.pdf"); writeFileSync(f, buf); return execFileSync("pdftotext", ["-raw", f, "-"]).toString(); };

let r = await get("/refund", c1);
ok(r.s === 200 && r.t.includes("Mohon refund") && !r.t.includes("✘"), "S1 (layak): semua semakan ✔ dan borang permohonan");
r = await get("/dashboard", c1); ok(r.t.includes("/refund") && r.t.includes("Refund dan bantuan"), "dashboard S1: pautan refund dalam tempoh");
r = await get("/refund", c3); ok(r.t.includes("Tempoh permohonan refund telah tamat") && !r.t.includes("Mohon refund</button>"), "S3 (5 hari): tempoh tamat, tiada borang");
r = await get("/dashboard", c3); ok(!r.t.includes("Refund dan bantuan"), "dashboard S3: tiada pautan Refund dan bantuan");
r = await get("/refund", c4); ok(r.t.includes("Tiada bayaran direkodkan"), "S4 (tanpa order): refund tidak terpakai");
r = await get("/refund"); ok(r.s === 307, "tetamu /refund -> log masuk");
r = await get("/admin/refund", c1); ok(r.s === 307, "pelajar /admin/refund ditolak");

// S1 mohon
const { data: q1 } = await db.rpc("request_refund", { p_enrollment: eS1.id, p_reason: "Tidak sesuai" });
r = await get("/refund", c1); ok(r.t.includes(`/api/refund/${q1.id}/surat`) && r.t.includes('name="surat"'), "S1: pautan surat + borang muat naik surat bertandatangan");
r = await get(`/api/refund/${q1.id}/surat`, c1);
ok(r.s === 200 && r.ct === "application/pdf" && r.buf.subarray(0, 5).toString() === "%PDF-", "surat refund: PDF untuk pemilik");
const txt = pdfText(r.buf);
ok(txt.includes("SURAT PERMOHONAN REFUND") && txt.includes("Ujian Refund s1".replace("s1", "s1")) && txt.includes(`RF${tag}S1`) && txt.includes("149.00"), "surat: tajuk, nama, no. order dan jumlah (RM 149.00)");
ok(txt.includes("DRAF") && /Tidak sesuai/.test(txt), "surat: DRAF watermark + sebab pelajar");
ok(!/no\.? ?k[ap]|kad pengenalan/i.test(txt) && txt.includes("akses saya kepada kursus akan ditutup"), "surat: tiada No. KP, ada pengakuan akses ditutup/sijil dibatalkan");
ok(!/dipulangkan sepenuhnya|yuran Bayarcash/i.test(txt), "surat: tidak memutuskan kadar pemulangan");
ok(/Butiran akaun bank/.test(txt) && /No\. akaun/.test(txt), "surat: ruang akaun bank tulis tangan (tidak disimpan dalam sistem)");
r = await get(`/api/refund/${q1.id}/surat`, c2); ok(r.s === 404, "surat: pelajar lain 404");
r = await get(`/api/refund/${q1.id}/surat`, cA); ok(r.s === 200, "surat: admin 200");
r = await get(`/api/refund/${q1.id}/surat`); ok(r.s === 401, "surat: tetamu 401");

// S2 gagal
const { data: q2 } = await db.rpc("request_refund", { p_enrollment: eS2.id, p_reason: null });
ok(q2.status === "auto_failed", "S2 (ada penghantaran): auto_failed");
r = await get("/refund", c2); ok(r.t.includes("hubungi admin") || r.t.includes("Hubungi admin") || r.t.includes("hubungi admin AHZ"), "S2: mesej hubungi admin, tiada surat");
r = await get(`/api/refund/${q2.id}/surat`, c2); ok(r.s === 403, "S2: surat tidak dikeluarkan (403)");
r = await get("/admin/refund", cA); ok(r.s === 200 && r.t.includes("Override (benarkan)") && r.t.includes("TIDAK LAYAK"), "admin: permohonan gagal ada override + semakan");

// S1: muat naik, luluskan, refund
const key = `refunds/${eS1.id}/surat-fixture.jpg`; const root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".local-storage");
mkdirSync(path.dirname(path.join(root, key)), { recursive: true }); copyFileSync("scripts/fixtures/foto-exif.jpg", path.join(root, key));
await db.rpc("attach_signed_letter", { p_request: q1.id, p_enrollment: eS1.id, p_file_key: key });
r = await get("/refund", c1); ok(r.t.includes("Menunggu semakan admin"), "S1: menunggu semakan admin");
let f = await fetch(`${BASE}/api/refund/${q1.id}/fail`, { headers: { cookie: c1 } }); ok(f.status === 200 && f.headers.get("content-type") === "image/jpeg", "surat bertandatangan: pemilik 200");
f = await fetch(`${BASE}/api/refund/${q1.id}/fail`, { headers: { cookie: c2 } }); ok(f.status === 404, "surat bertandatangan: pelajar lain 404");
r = await get("/admin/refund", cA); ok(r.t.includes("Luluskan") && r.t.includes("Surat bertandatangan"), "admin: butang luluskan + pautan surat bertandatangan");
await db.rpc("decide_refund", { p_actor: ADM.id, p_request: q1.id, p_decision: "approved", p_note: null });
r = await get("/refund", c1); ok(r.t.includes("Permohonan diluluskan") && r.t.toLowerCase().includes("akses anda kekal"), "S1: diluluskan, akses KEKAL sehingga dipulangkan");
r = await get("/admin/refund", cA); ok(r.t.includes("Telah dipulangkan (transfer bank)"), "admin: butang 'telah dipulangkan' selepas lulus");
const { data: cert } = await db.from("certificates").insert({ course_id: course.id, enrollment_id: eS1.id, type: "theory", cert_id: `AHZ-RF-${tag}`, holder_name: "Ujian Refund s1", course_title: "T", period_start: "2026-10-01", period_end: "2026-10-02" }).select("id, verify_token").single();
await db.rpc("mark_refunded", { p_actor: ADM.id, p_request: q1.id, p_note: "BC-REF-1" });
r = await get("/refund", c1); ok(r.t.includes("Refund telah diproses"), "S1: refund diproses, akses ditutup");
r = await get("/dashboard", c1); ok(r.t.includes("Akses ditutup (refund)"), "dashboard S1: akses ditutup (refund)");
r = await get(`/api/sijil/${cert.id}`, c1); ok(r.s === 410, "sijil S1: dibatalkan (410)");
r = await get(`/semak/${cert.verify_token}`); ok(r.t.includes("TELAH DIBATALKAN"), "semakan awam sijil: DIBATALKAN");
r = await get("/kuiz/akhir", c1); ok(r.s === 307, "kuiz S1 ditutup selepas refund");
console.log(JSON.stringify({ s1: S1.email, s2: S2.email, s3: S3.email, adm: ADM.email, password: PW }));
console.log(fail ? `${fail} GAGAL` : "semua lulus"); process.exit(fail ? 1 : 0);
