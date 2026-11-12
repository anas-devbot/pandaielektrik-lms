// Ujian PERJALANAN PENUH (Pintu 1): dua trek dari bayaran hingga sijil. HTTP untuk apa pelajar nampak, RPC (service-role) untuk tindakan
// server action yang tak boleh dipanggil melalui HTTP. Perlu app (BASE_URL :3101, kunci Bayarcash UJIAN) + Supabase LOCAL.
//   BAYARCASH_PAT=x BAYARCASH_PORTAL_KEY=x BAYARCASH_SECRET_KEY=test-secret-bukan-kunci-sebenar STORAGE_DRIVER=local npx next dev -H 127.0.0.1 -p 3101
// Guna: node --env-file=.env.local scripts/test-journey.mjs     Bersihkan: supabase/tests/cleanup-journey-data.sql
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createChecksumValue } from "bayarcash";
import { randomBytes } from "node:crypto";
import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101", PW = "UjiLocal-Jurnal-9zQx", SECRET = "test-secret-bukan-kunci-sebenar";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };
const tag = randomBytes(2).toString("hex"), GUIDE = `PANDUAN-AHZ-UJI-${tag}`;
const rpc = async (n, a) => { const r = await db.rpc(n, a); if (r.error) throw new Error(`${n}: ${r.error.message}`); return r.data; };
const rpcErr = async (n, a) => (await db.rpc(n, a)).error?.message ?? null;

// --- persediaan: konfigurasi & fixture (dipulihkan oleh cleanup) ---
const { data: course } = await db.from("courses").select("id, price, config").order("created_at").limit(1).single();
await db.from("courses").update({ config: { ...course.config, mcq_count: 6, pass_mark_mcq: 70, max_mcq_attempts: 3, video_complete_pct: 0.9, energize_guidance_text: GUIDE } }).eq("id", course.id);
const chap = async (p) => (await db.from("chapters").insert({ course_id: course.id, position: p, title: `JRN-${tag}-${p}` }).select("id").single()).data;
const [c1, c2] = [await chap(920), await chap(921)];
const lesson = async (ch, p) => (await db.from("lessons").insert({ course_id: course.id, chapter_id: ch.id, position: p, title: `JRNL-${tag}-${p}`, video_ref: "x", duration_seconds: 100 }).select("id").single()).data;
const [l1, l2] = [await lesson(c1, 920), await lesson(c2, 921)];
const mkq = async (ch, type, n) => { for (let i = 0; i < n; i++) {
  const { data: q } = await db.from("quiz_questions").insert({ course_id: course.id, chapter_id: ch.id, type, body: `JRNQ-${type}-${tag}-${i}` }).select("id").single();
  await db.from("quiz_options").insert(["A", "B", "C", "D"].map((l) => ({ question_id: q.id, label: l, body: `OPT-${l}`, is_correct: l === "B" }))); } };
await mkq(c1, "final", 6); await mkq(c2, "final", 6); await mkq(c1, "practice", 2);

const mk = async (n, role) => {
  if (role) await db.from("staff_invites").insert({ email: `jn-${tag}-${n}@test.local`, role });
  return (await db.auth.admin.createUser({ email: `jn-${tag}-${n}@test.local`, password: PW, email_confirm: true, user_metadata: { privacy_accepted: true, phone: "0123456789", full_name: `Jurnal ${n}` } })).data.user;
};
const [T, P, X, REV, APR] = [await mk("teori"), await mk("prak"), await mk("lain"), await mk("rev", "reviewer"), await mk("apr", "approver")];

async function cookieFor(email) {
  const jar = new Map();
  const sb = createServerClient(URL_, KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PW }); if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const get = async (p, c) => { const r = await fetch(BASE + p, { redirect: "manual", headers: c ? { cookie: c } : {} }); const ct = r.headers.get("content-type") ?? ""; const buf = Buffer.from(await r.arrayBuffer()); return { s: r.status, loc: r.headers.get("location") ?? "", ct, buf, t: /pdf|image/.test(ct) ? "" : buf.toString().replace(/<!-- -->/g, "") }; };
const dash = async (c) => (await get("/dashboard", c)).t;

// --- bayaran sebenar melalui route callback (checksum ditandatangani dengan kunci UJIAN) ---
const FIELDS = ["record_type","transaction_id","exchange_reference_number","exchange_transaction_id","order_number","currency","amount","payer_name","payer_email","payer_bank_name","status","status_description","datetime"];
async function pay(user, n) {
  const ord = (await db.from("orders").insert({ user_id: user.id, course_id: course.id, order_number: `JN${tag}${n}`.toUpperCase(), amount: course.price, terms_accepted_at: new Date().toISOString() }).select("order_number").single()).data;
  const d = { record_type: "transaction", transaction_id: "trx_" + randomBytes(3).toString("hex"), exchange_reference_number: "BPG1", exchange_transaction_id: "x1", order_number: ord.order_number, currency: "MYR",
    amount: (course.price / 100).toFixed(2), payer_name: "U", payer_email: "u@t.local", payer_bank_name: "B", status: "3", status_description: "Successful", datetime: "2026-10-27 02:14:06" };
  const body = { ...d, checksum: createChecksumValue(SECRET, Object.fromEntries(FIELDS.map((k) => [k, d[k]]))) };
  const post = () => fetch(BASE + "/api/bayarcash/callback", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body).toString() }).then((r) => r.status);
  const codes = [await post(), await post(), await post()];
  const { data: es } = await db.from("enrollments").select("id, stage, access_ends_at").eq("user_id", user.id);
  return { codes, es };
}

const root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".local-storage");
const fixture = (key) => { mkdirSync(path.dirname(path.join(root, key)), { recursive: true }); copyFileSync("scripts/fixtures/foto-exif.jpg", path.join(root, key)); return key; };

async function watch(enr, lesson) {
  const t0 = Date.now() - 3600e3;
  for (let s = 0; s <= 100; s += 5) await rpc("record_heartbeat", { p_enrollment: enr, p_lesson: lesson, p_position: s, p_now: new Date(t0 + s * 1000).toISOString() });
}
const answers = async (att, right) => {
  const { data: a } = await db.from("quiz_attempts").select("question_ids").eq("id", att).single();
  const { data: opts } = await db.from("quiz_options").select("id, question_id, is_correct").in("question_id", a.question_ids);
  return Object.fromEntries(a.question_ids.map((q) => [q, opts.find((o) => o.question_id === q && o.is_correct === right).id]));
};

/** Aliran bersama kedua-dua trek: bayar -> belajar -> MCQ -> bahagian 2 -> theory_passed. */
async function toTheoryPassed(user, n, label) {
  const cookie = await cookieFor(user.email);
  const { codes, es } = await pay(user, n);
  ok(codes.every((c) => c === 200) && es.length === 1 && es[0].stage === "enrolled", `${label}: bayaran (callback x3) -> satu enrollment 'enrolled'`);
  const enr = es[0].id;
  ok((await dash(cookie)).includes("Jurnal"), `${label}: dashboard dipaparkan`);

  let r = await get("/kuiz/akhir", cookie); ok(r.t.includes("dibuka selepas setiap video") && !r.t.includes("Mula percubaan"), `${label}: MCQ akhir tertutup sebelum video`);
  ok(await rpcErr("start_quiz", { p_enrollment: enr, p_type: "final" }) === "gate_closed", `${label}: DB tolak start_quiz (gate_closed)`);
  r = await get("/bahagian2", cookie); ok(r.t.includes("dibuka selepas ujian akhir lulus"), `${label}: bahagian 2 tertutup sebelum MCQ lulus`);

  // latihan bab tidak menghalang dan tidak mengubah stage
  const pa = await rpc("start_quiz", { p_enrollment: enr, p_type: "practice", p_chapter: c1.id });
  await rpc("submit_quiz", { p_attempt: pa, p_enrollment: enr, p_answers: await answers(pa, true) });

  await watch(enr, l1.id);
  r = await get("/kuiz/akhir", cookie); ok(r.t.includes("dibuka selepas setiap video"), `${label}: satu video selesai sahaja -> MCQ masih tertutup`);
  await watch(enr, l2.id);
  r = await get("/kuiz/akhir", cookie); ok(r.t.includes("Mula percubaan"), `${label}: kedua-dua video >= 90% saat unik -> MCQ dibuka`);

  const a1 = await rpc("start_quiz", { p_enrollment: enr, p_type: "final" });
  const f = await rpc("submit_quiz", { p_attempt: a1, p_enrollment: enr, p_answers: await answers(a1, false) });
  ok(f.passed === false && f.score_pct === 0, `${label}: MCQ semua salah -> gagal`);
  r = await get("/bahagian2", cookie); ok(r.t.includes("dibuka selepas ujian akhir lulus"), `${label}: bahagian 2 masih tertutup selepas MCQ gagal`);
  const a2 = await rpc("start_quiz", { p_enrollment: enr, p_type: "final" });
  const p = await rpc("submit_quiz", { p_attempt: a2, p_enrollment: enr, p_answers: await answers(a2, true) });
  ok(p.passed === true && p.score_pct === 100 && p.total === 6, `${label}: percubaan ke-2 lulus (6 soalan)`);
  r = await get("/bahagian2", cookie); ok(r.s === 200 && !r.t.includes("dibuka selepas ujian akhir lulus"), `${label}: bahagian 2 dibuka selepas MCQ lulus`);

  // bahagian 2: subjektif + skematik -> reviewer
  const sj = await rpc("submit_part2", { p_enrollment: enr, p_type: "subjective", p_text: "Jawapan subjektif ujian.", p_file_key: null });
  const sk = await rpc("submit_part2", { p_enrollment: enr, p_type: "schematic", p_text: null, p_file_key: fixture(`submissions/${enr}/skematik-${tag}.jpg`) });
  await rpc("claim_review", { p_enrollment: enr, p_reviewer: REV.id });
  await rpc("review_submission", { p_submission: sj, p_reviewer: REV.id, p_decision: "approved", p_comment: "OK" });
  ok((await db.from("enrollments").select("stage").eq("id", enr).single()).data.stage === "part2_review", `${label}: subjektif sahaja diluluskan -> belum theory_passed`);
  await rpc("review_submission", { p_submission: sk, p_reviewer: REV.id, p_decision: "approved", p_comment: "OK" });
  ok((await db.from("enrollments").select("stage").eq("id", enr).single()).data.stage === "theory_passed", `${label}: subjektif + skematik lulus -> theory_passed`);
  r = await get("/dashboard", cookie); ok(r.t.includes("Pilih trek"), `${label}: dashboard menawarkan pilihan trek`);
  return { enr, cookie };
}

/** Sijil: PDF untuk pemilik sahaja, halaman semakan awam tanpa data peribadi. */
async function checkCertificate(enr, cookie, cookieOther, type, name, label) {
  const id = await rpc("issue_certificate", { p_enrollment: enr, p_type: type, p_holder_name: name });
  const { data: c } = await db.from("certificates").select("verify_token, cert_id").eq("id", id).single();
  let r = await get(`/api/sijil/${id}`, cookie); ok(r.s === 200 && r.ct === "application/pdf" && r.buf.subarray(0, 5).toString() === "%PDF-", `${label}: PDF sijil untuk pemilik`);
  r = await get(`/api/sijil/${id}`, cookieOther); ok(r.s === 404, `${label}: pelajar lain tak boleh muat turun sijil`);
  r = await get(`/api/sijil/${id}`); ok(r.s === 401, `${label}: tetamu tak boleh muat turun sijil`);
  r = await get(`/semak/${c.verify_token}`); ok(r.s === 200 && r.t.toLowerCase().includes(name.toLowerCase()) && r.t.includes(c.cert_id) && !/[\w.-]+@[\w-]+\.\w+/.test(r.t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")), `${label}: semakan QR awam: nama + ID sijil, tiada emel`);
  ok((await db.from("enrollments").select("stage").eq("id", enr).single()).data.stage === "completed", `${label}: stage 'completed'`);
  return id;
}

try {
  const cX = await cookieFor(X.email);

  // ===== TREK A: TEORI SAHAJA =====
  const A = await toTheoryPassed(T, "A", "Trek A");
  ok(await rpcErr("issue_certificate", { p_enrollment: A.enr, p_type: "theory", p_holder_name: "Ali Ujian" }) === "not_eligible", "Trek A: sijil ditolak sebelum trek dipilih");
  await rpc("choose_track", { p_enrollment: A.enr, p_track: "theory" });
  ok(await rpcErr("issue_certificate", { p_enrollment: A.enr, p_type: "theory_practical", p_holder_name: "Ali Ujian" }) === "not_eligible", "Trek A: sijil Teori & Praktikal ditolak untuk trek teori");
  ok(await rpcErr("issue_certificate", { p_enrollment: A.enr, p_type: "theory", p_holder_name: "Ali <b>" }) === "bad_name", "Trek A: nama sijil tak sah ditolak");
  const certA = await checkCertificate(A.enr, A.cookie, cX, "theory", "Ali Bin Ujian", "Trek A");
  ok((await get("/praktikal", A.cookie)).s === 307, "Trek A: /praktikal tak terbuka untuk trek teori");

  // ===== TREK B: TEORI + PRAKTIKAL =====
  const B = await toTheoryPassed(P, "B", "Trek B");
  await rpc("choose_track", { p_enrollment: B.enr, p_track: "theory_practical" });
  ok((await db.from("enrollments").select("stage, cert_track").eq("id", B.enr).single()).data.stage === "practical", "Trek B: pilih trek praktikal -> stage practical");
  ok(await rpcErr("issue_certificate", { p_enrollment: B.enr, p_type: "theory_practical", p_holder_name: "Bakar Ujian" }) === "not_eligible", "Trek B: sijil ditolak sebelum praktikal");
  const WAIT = "Menunggu pengesahan AHZ. Jangan masukkan bekalan.";
  let r = await get("/praktikal", B.cookie); ok(r.t.includes(WAIT) && !r.t.includes(GUIDE), "Trek B: notis 'Jangan masukkan bekalan', tiada kebenaran");
  ok(await rpcErr("submit_practical", { p_enrollment: B.enr, p_type: "video", p_file_key: null, p_external_ref: "Telegram", p_consent: true }) !== null, "Trek B: video tanpa borang ditolak (borang dahulu)");
  const f1 = await rpc("submit_practical", { p_enrollment: B.enr, p_type: "form", p_file_key: fixture(`submissions/${B.enr}/borang-${tag}.jpg`), p_external_ref: null, p_consent: null });
  ok(await rpcErr("submit_practical", { p_enrollment: B.enr, p_type: "video", p_file_key: null, p_external_ref: "Telegram", p_consent: false }) !== null, "Trek B: video tanpa persetujuan privasi Telegram ditolak");
  const v1 = await rpc("submit_practical", { p_enrollment: B.enr, p_type: "video", p_file_key: null, p_external_ref: "Telegram 27/10 10:30", p_consent: true });
  await rpc("claim_practical", { p_enrollment: B.enr, p_reviewer: REV.id });
  await rpc("review_practical_item", { p_submission: f1, p_reviewer: REV.id, p_decision: "approved", p_comment: null });
  await rpc("review_practical_item", { p_submission: v1, p_reviewer: REV.id, p_decision: "approved", p_comment: null });
  r = await get("/praktikal", B.cookie); ok(r.t.includes(WAIT) && !r.t.includes(GUIDE), "Trek B: reviewer lulus borang+video, pelajar MASIH 'Jangan masukkan bekalan'");
  ok((await rpcErr("approve_energize", { p_actor: REV.id, p_enrollment: B.enr, p_video: v1 }))?.includes("actor_not_approver"), "Trek B: reviewer tak boleh luluskan bekalan");
  await rpc("approve_energize", { p_actor: APR.id, p_enrollment: B.enr, p_video: v1 });
  r = await get("/praktikal", B.cookie); ok(r.t.includes("Kebenaran memasukkan bekalan telah direkodkan oleh AHZ") && r.t.includes(GUIDE), "Trek B: approver lulus -> kebenaran + teks panduan AHZ dipaparkan");
  const { data: act } = await db.from("admin_actions").select("action, actor_id, detail").eq("enrollment_id", B.enr).eq("action", "energize_approval");
  ok(act.length === 1 && act[0].actor_id === APR.id && JSON.stringify(act[0].detail).includes(GUIDE), "Trek B: admin_actions rekod approver + teks panduan");

  // hantar semula video -> kelulusan dibatalkan automatik
  const v2 = await rpc("submit_practical", { p_enrollment: B.enr, p_type: "video", p_file_key: null, p_external_ref: "Telegram video baharu", p_consent: true });
  r = await get("/praktikal", B.cookie); ok(r.t.includes(WAIT) && !r.t.includes(GUIDE), "Trek B: hantar semula video -> kelulusan dibatalkan, 'Jangan masukkan bekalan' kembali");
  ok((await db.from("enrollments").select("energize_approved_at").eq("id", B.enr).single()).data.energize_approved_at === null, "Trek B: energize_approved_at dikosongkan");
  ok(await rpcErr("approve_energize", { p_actor: APR.id, p_enrollment: B.enr, p_video: v1 }) !== null, "Trek B: kelulusan terhadap video LAMA ditolak");
  await rpc("claim_practical", { p_enrollment: B.enr, p_reviewer: REV.id });
  await rpc("review_practical_item", { p_submission: v2, p_reviewer: REV.id, p_decision: "approved", p_comment: null });
  await rpc("approve_energize", { p_actor: APR.id, p_enrollment: B.enr, p_video: v2 });

  ok(await rpcErr("issue_certificate", { p_enrollment: B.enr, p_type: "theory_practical", p_holder_name: "Bakar Ujian" }) === "not_eligible", "Trek B: kelulusan bekalan SAHAJA tak cukup untuk sijil (perlu keputusan praktikal)");
  await rpc("record_practical_result", { p_reviewer: REV.id, p_enrollment: B.enr, p_result: "belum", p_comment: "ulang" });
  r = await get("/praktikal", B.cookie); ok(!r.t.includes(GUIDE), "Trek B: keputusan 'belum' membatalkan kebenaran bekalan");
  ok(await rpcErr("issue_certificate", { p_enrollment: B.enr, p_type: "theory_practical", p_holder_name: "Bakar Ujian" }) === "not_eligible", "Trek B: keputusan 'belum' -> tiada sijil");
  const v3 = await rpc("submit_practical", { p_enrollment: B.enr, p_type: "video", p_file_key: null, p_external_ref: "Telegram video ketiga", p_consent: true });
  await rpc("claim_practical", { p_enrollment: B.enr, p_reviewer: REV.id });
  await rpc("review_practical_item", { p_submission: v3, p_reviewer: REV.id, p_decision: "approved", p_comment: null });
  await rpc("approve_energize", { p_actor: APR.id, p_enrollment: B.enr, p_video: v3 });
  await rpc("record_practical_result", { p_reviewer: REV.id, p_enrollment: B.enr, p_result: "lulus", p_comment: null });
  await checkCertificate(B.enr, B.cookie, cX, "theory_practical", "Bakar Bin Ujian", "Trek B");

  // ===== RLS merentas pelajar =====
  const sbX = createClient(URL_, KEY, { auth: { persistSession: false } }); await sbX.auth.signInWithPassword({ email: X.email, password: PW });
  for (const [t, col] of [["enrollments", "id"], ["submissions", "id"], ["certificates", "id"], ["quiz_attempts", "id"], ["lesson_progress", "enrollment_id"], ["orders", "id"]]) {
    const { data } = await sbX.from(t).select(col); ok((data ?? []).length === 0, `RLS: pelajar lain nampak 0 baris ${t}`);
  }
  const sbA = createClient(URL_, KEY, { auth: { persistSession: false } }); await sbA.auth.signInWithPassword({ email: T.email, password: PW });
  const own = await sbA.from("certificates").select("id"); ok(own.data?.length === 1 && own.data[0].id === certA, "RLS: pelajar A nampak sijil sendiri sahaja");
  const key = await sbA.from("quiz_options").select("is_correct"); ok(!!key.error, "RLS: kunci jawapan tak boleh dibaca terus");
} catch (e) { console.error(e); fail++; }
console.log(fail ? `\n${fail} GAGAL` : "\nSemua lulus"); process.exit(fail ? 1 : 0);
