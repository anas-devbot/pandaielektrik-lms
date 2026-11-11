// Ujian hujung-ke-hujung slice 5 terhadap Supabase LOCAL + app (BASE_URL, default :3101).
// Mula app: R2_BUCKET=pe-materials-test npx next dev -H 127.0.0.1 -p 3101   (tandatangan URL dibuat luar talian, tiada panggilan R2)
// Guna: node --env-file=.env.local scripts/test-learning.mjs   Bersihkan: supabase/tests/cleanup-learning-data.sql
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomBytes } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tag = randomBytes(3).toString("hex"), pw = randomBytes(12).toString("hex");
const mk = async (n) => (await db.auth.admin.createUser({ email: `lr-${n}-${tag}@test.local`, password: pw, email_confirm: true,
  user_metadata: { privacy_accepted: true, phone: "0123456789", full_name: `LR ${n}` } })).data.user;
const [A, B, C] = [await mk("a"), await mk("b"), await mk("c")];
const { data: course } = await db.from("courses").select("id").limit(1).single();
const { data: ch } = await db.from("chapters").insert({ course_id: course.id, position: 900 + Math.floor(Math.random() * 90), title: `LRBAB-${tag}` }).select("id").single();
const VREF = `vid-${tag}`, RKEY = `secret/key-${tag}.pdf`;
const { data: lesson } = await db.from("lessons").insert({ course_id: course.id, chapter_id: ch.id, position: 1, title: `LRPELAJARAN-${tag}`, video_ref: VREF, duration_seconds: 600 }).select("id").single();
const { data: mat } = await db.from("materials").insert({ course_id: course.id, chapter_id: ch.id, title: `LRPDF-${tag}`, r2_key: RKEY }).select("id").single();
const far = new Date(Date.now() + 180 * 864e5).toISOString(), past = new Date(Date.now() - 864e5).toISOString();
const { data: eA } = await db.from("enrollments").insert({ user_id: A.id, course_id: course.id, access_ends_at: far }).select("id").single();
await db.from("enrollments").insert({ user_id: C.id, course_id: course.id, access_ends_at: past });

async function cookieFor(email) {
  const jar = new Map();
  const sb = createServerClient(URL_, KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await sb.auth.signInWithPassword({ email, password: pw }); if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const call = (path, cookie, init = {}) => fetch(BASE + path, { redirect: "manual", ...init, headers: { ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) } });
const hb = (cookie, position, lessonId = lesson.id) => call("/api/progress/heartbeat", cookie, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId, position }) });

try {
  const [cA, cB, cC] = [await cookieFor(A.email), await cookieFor(B.email), await cookieFor(C.email)];

  // heartbeat
  ok((await hb(null, 0)).status === 401, "heartbeat tanpa log masuk = 401");
  ok((await hb(cB, 0)).status === 403, "heartbeat pelajar tak berenrollment = 403");
  const rc = await hb(cC, 0); const jc = await rc.json();
  ok(rc.status === 403 && jc.error === "access_closed", "heartbeat akses tamat = 403 access_closed");
  ok((await call("/api/progress/heartbeat", cA, { method: "POST", headers: { "content-type": "application/json" }, body: "{x" })).status === 400, "badan rosak = 400");
  ok((await hb(cA, -5)).status === 400 && (await hb(cA, 1.5)).status === 400, "kedudukan negatif / bukan integer = 400");
  ok((await hb(cA, 0, "00000000-0000-0000-0000-000000000000")).status === 404, "pelajaran tak wujud = 404");
  let r = await (await hb(cA, 0)).json(); ok(r.watched === 1, "heartbeat pertama = 1 saat");
  r = await (await hb(cA, 4)).json(); ok(r.ignored === true && r.watched === 1, "heartbeat serta-merta (<2s) diabaikan oleh server");
  await sleep(3200);
  r = await (await hb(cA, 4)).json(); ok(r.watched === 5, `selepas 3s kedudukan 4: kredit julat (5 saat, dapat ${r.watched})`);
  await sleep(3200);
  r = await (await hb(cA, 500)).json(); ok(r.watched === 6, `lompat ke 500: +1 sahaja (dapat ${r.watched})`);
  ok(r.completed === false, "lompat tidak menanda selesai");

  // PDF signed URL
  ok((await call(`/api/materials/${mat.id}`)).status === 401, "PDF tanpa log masuk = 401");
  ok((await call(`/api/materials/${mat.id}`, cB)).status === 403, "PDF tanpa enrollment = 403");
  ok((await call(`/api/materials/${mat.id}`, cC)).status === 403, "PDF akses tamat = 403");
  const { count: before } = await db.from("material_access_log").select("*", { count: "exact", head: true }).eq("material_id", mat.id);
  ok(before === 0, "tiada log akses untuk percubaan ditolak");
  const pdf = await call(`/api/materials/${mat.id}`, cA);
  const loc = pdf.headers.get("location") ?? "";
  const u = loc ? new URL(loc) : null;
  ok(pdf.status === 302 && !!u, "PDF enrollment aktif = 302 ke signed URL");
  ok(u?.hostname.endsWith(".r2.cloudflarestorage.com") && u.pathname.includes(`key-${tag}.pdf`), "signed URL ke R2, kunci objek betul");
  ok(u?.searchParams.get("X-Amz-Expires") === "60" && !!u.searchParams.get("X-Amz-Signature"), "signed URL tamat dalam 60s dan bertandatangan");
  ok((pdf.headers.get("cache-control") ?? "").includes("no-store"), "redirect PDF tidak boleh di-cache");
  const { count: after } = await db.from("material_access_log").select("*", { count: "exact", head: true }).eq("material_id", mat.id).eq("enrollment_id", eA.id);
  ok(after === 1, "akses PDF direkod dalam material_access_log");
  ok((await call("/api/materials/00000000-0000-0000-0000-000000000000", cA)).status === 404, "PDF tak wujud = 404");

  // halaman: video_ref / r2_key tidak bocor
  const txt = async (p, c) => { const x = await call(p, c); return { s: x.status, t: await x.text() }; };
  let d = await txt("/dashboard", cA);
  ok(d.s === 200 && d.t.includes(`LRPELAJARAN-${tag}`) && d.t.includes(`LRPDF-${tag}`), "dashboard pelajar aktif papar pelajaran dan PDF");
  ok(!d.t.includes(VREF) && !d.t.includes(RKEY), "dashboard TIDAK mengandungi video_ref atau r2_key");
  ok(/1[0-9]?%|0%|Selesai/.test(d.t) && d.t.includes("Anda di langkah ini"), "dashboard papar kemajuan dan langkah semasa");
  d = await txt(`/belajar/${lesson.id}`, cA);
  ok(d.s === 200 && d.t.includes(VREF), "halaman video pelajar aktif ada video_ref");
  ok(!d.t.includes(RKEY), "halaman video tiada r2_key");
  d = await txt(`/belajar/${lesson.id}`, cC);
  ok(d.s === 200 && d.t.includes("Akses video telah tamat") && !d.t.includes(VREF), "halaman video akses tamat: video_ref TIDAK dihantar");
  d = await txt("/dashboard", cC);
  ok(d.s === 200 && d.t.includes("tamat") && !d.t.includes(`href="/belajar/${lesson.id}"`) && !d.t.includes(`/api/materials/${mat.id}`), "dashboard akses tamat: pautan video dan PDF ditutup");
  ok((await call(`/belajar/${lesson.id}`, cB)).status === 404, "halaman video tanpa enrollment = 404");
  ok((await call(`/belajar/${lesson.id}`)).status === 307, "halaman video tetamu = 307 ke log masuk");
  d = await txt("/dashboard", cB);
  ok(d.t.includes("belum mendaftar"), "dashboard tanpa enrollment tawar pembelian");

  // RLS: A tidak nampak progress B
  const sa = createClient(URL_, KEY, { auth: { persistSession: false } }); await sa.auth.signInWithPassword({ email: A.email, password: pw });
  const { data: mine } = await sa.from("lesson_progress").select("watched_seconds_unique"); ok(mine.length === 1, "pelajar baca progress sendiri sahaja (RLS)");
  const { error: wr } = await sa.from("lesson_progress").update({ watched_seconds_unique: 600 }).eq("enrollment_id", eA.id);
  const { data: chk } = await db.from("lesson_progress").select("watched_seconds_unique").eq("enrollment_id", eA.id).single();
  ok(chk.watched_seconds_unique === 6, `pelajar tak boleh tulis progress sendiri (${wr ? "ditolak" : "tiada kesan"})`);
} finally {
  console.log("bersihkan: supabase/tests/cleanup-learning-data.sql");
}
console.log(fail ? `${fail} GAGAL` : "semua lulus"); process.exit(fail ? 1 : 0);
