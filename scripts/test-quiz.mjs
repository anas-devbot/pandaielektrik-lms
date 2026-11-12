// Ujian e2e slice 6: kunci tak bocor ke klien + guard halaman. Perlu app berjalan (BASE_URL, default :3101) dan Supabase LOCAL.
// Menetapkan sementara courses.config.mcq_count=6 pada kursus seed; pulihkan dengan supabase/tests/cleanup-quiz-data.sql.
// Guna: node --env-file=.env.local scripts/test-quiz.mjs
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomBytes } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };
const tag = randomBytes(3).toString("hex"), pw = randomBytes(12).toString("hex");

const mk = async (n) => (await db.auth.admin.createUser({ email: `qz-${n}-${tag}@test.local`, password: pw, email_confirm: true, user_metadata: { privacy_accepted: true, phone: "0123456789", full_name: `QZ ${n}` } })).data.user;
const [A, B, C] = [await mk("a"), await mk("b"), await mk("c")];
const { data: course } = await db.from("courses").select("id, config").order("created_at").limit(1).single();
await db.from("courses").update({ config: { ...course.config, mcq_count: 6 } }).eq("id", course.id);
const chap = async (p) => (await db.from("chapters").insert({ course_id: course.id, position: p, title: `QZBAB-${tag}-${p}` }).select("id").single()).data;
const [c1, c2] = [await chap(910), await chap(911)];
const SECRET_EXPL = `PENJELASAN-RAHSIA-${tag}`;
const mkq = async (ch, type, n) => { for (let i = 0; i < n; i++) {
  const { data: q } = await db.from("quiz_questions").insert({ course_id: course.id, chapter_id: ch.id, type, body: `SOALAN-${type}-${tag}-${ch.id.slice(0, 4)}-${i}`, explanation: SECRET_EXPL }).select("id").single();
  await db.from("quiz_options").insert(["A", "B", "C", "D"].map((l) => ({ question_id: q.id, label: l, body: `PILIHAN-${l}-${tag}`, is_correct: l === "B" }))); } };
await mkq(c1, "final", 5); await mkq(c2, "final", 5); await mkq(c1, "practice", 2);
const { data: l1 } = await db.from("lessons").insert({ course_id: course.id, chapter_id: c1.id, position: 1, title: `QZL-${tag}`, video_ref: "x", duration_seconds: 100 }).select("id").single();
const far = new Date(Date.now() + 90 * 864e5).toISOString(), past = new Date(Date.now() - 864e5).toISOString();
const eA = (await db.from("enrollments").insert({ user_id: A.id, course_id: course.id, access_ends_at: far }).select("id").single()).data;
const eB = (await db.from("enrollments").insert({ user_id: B.id, course_id: course.id, access_ends_at: far }).select("id").single()).data;
await db.from("enrollments").insert({ user_id: C.id, course_id: course.id, access_ends_at: past });
// A: SEMUA video kursus selesai (gate terbuka, PRD: setiap video >= 90%). B: video belum (gate tertutup).
// Kursus lokal boleh ada video lain dari ujian terdahulu, jadi tandakan semua, bukan l1 sahaja.
const { data: allLessons } = await db.from("lessons").select("id").eq("course_id", course.id);
await db.from("lesson_progress").insert(allLessons.map((l) => ({ enrollment_id: eA.id, lesson_id: l.id, watched_seconds_unique: 100, completed_at: new Date().toISOString() })));

async function cookieFor(email) {
  const jar = new Map();
  const sb = createServerClient(URL_, KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await sb.auth.signInWithPassword({ email, password: pw }); if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const get = async (p, c) => { const r = await fetch(BASE + p, { redirect: "manual", headers: c ? { cookie: c } : {} }); return { s: r.status, loc: r.headers.get("location") ?? "", t: await r.text() }; };

const [cA, cB, cC] = [await cookieFor(A.email), await cookieFor(B.email), await cookieFor(C.email)];
// gate
let r = await get("/kuiz/akhir", cB); ok(r.s === 200 && r.t.includes("dibuka selepas setiap video") && !r.t.includes("Mula percubaan"), "B (video belum selesai): MCQ akhir tertutup, tiada butang mula");
const sb = await db.rpc("start_quiz", { p_enrollment: eB.id, p_type: "final" }); ok(sb.error?.message === "gate_closed", "B: start_quiz ditolak oleh DB (gate_closed)");
r = await get("/kuiz/akhir", cA); ok(r.s === 200 && r.t.includes("Mula percubaan"), "A (video selesai): butang Mula percubaan dipaparkan");
r = await get("/kuiz/akhir", cC); ok(r.s === 307 && r.loc.endsWith("/dashboard"), "C (akses tamat): MCQ akhir -> /dashboard");
r = await get("/kuiz/akhir"); ok(r.s === 307 && r.loc.includes("/log-masuk"), "tetamu -> /log-masuk");

// percubaan A: halaman soalan tidak membocorkan kunci
const att = (await db.rpc("start_quiz", { p_enrollment: eA.id, p_type: "final" })).data;
r = await get(`/kuiz/${att}`, cA);
ok(r.s === 200 && (r.t.match(new RegExp(`SOALAN-final-${tag}`, "g")) ?? []).length >= 6, "A: halaman percubaan memaparkan 6 soalan");
ok(!/is_correct|correct_option_id|chosen_option_id/.test(r.t) && !r.t.includes(SECRET_EXPL), "A: HTML tidak mengandungi is_correct, correct_option_id atau penjelasan");
const { data: qs } = await db.from("quiz_attempts").select("question_ids").eq("id", att).single();
const { data: right } = await db.from("quiz_options").select("id").in("question_id", qs.question_ids).eq("is_correct", true);
ok(r.t.includes(right[0].id) , "A: id pilihan hadir (perlu untuk menjawab) tetapi tiada penanda mana yang betul");
r = await get(`/kuiz/${att}`, cB); ok(r.s === 404, "B tak boleh buka percubaan A (404)");
r = await get(`/kuiz/${att}`, cC); ok(r.s === 307, "C (akses tamat) tak boleh buka percubaan");
// Kuiz latihan per bab DIBUANG (commit 76f5102): route /kuiz/bab tidak wujud lagi.
r = await get(`/kuiz/bab/${c1.id}`, cA); ok(r.s === 404, "route kuiz latihan bab dibuang: 404");
r = await get("/dashboard", cA); ok(r.t.includes("Buka ujian akhir") && !r.t.includes("/kuiz/bab/"), "dashboard A: pautan ujian akhir sahaja, tiada kuiz latihan bab");
r = await get("/dashboard", cB); ok(r.t.includes("Dibuka selepas setiap video dicapai"), "dashboard B: MCQ akhir belum dibuka");

// klien terus ke DB: kunci tak boleh dibaca atau dipanggil
const sa = createClient(URL_, KEY, { auth: { persistSession: false } }); await sa.auth.signInWithPassword({ email: A.email, password: pw });
const o = await sa.from("quiz_options").select("is_correct"); ok(!!o.error, `A: select quiz_options terus ditolak (${o.error?.code})`);
const q = await sa.from("quiz_questions").select("id"); ok(!!q.error, `A: select quiz_questions terus ditolak (${q.error?.code})`);
for (const fn of ["start_quiz", "get_attempt", "submit_quiz", "final_gate"]) {
  const x = await sa.rpc(fn, { p_enrollment: eA.id, p_type: "final", p_attempt: att, p_answers: {} }); ok(!!x.error, `A: rpc ${fn} terus ditolak (${x.error?.code})`);
}
const an = createClient(URL_, KEY, { auth: { persistSession: false } });
const y = await an.from("quiz_options").select("is_correct"); ok(!!y.error, "anon: select quiz_options ditolak");
console.log("bersihkan: supabase/tests/cleanup-quiz-data.sql");
console.log(JSON.stringify({ attempt: att, userA: A.email, tag }));
console.log(fail ? `${fail} GAGAL` : "semua lulus"); process.exit(fail ? 1 : 0);
