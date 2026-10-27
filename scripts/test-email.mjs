// Ujian e2e slice 13: resit (callback) + cron peringatan, dengan Resend PALSU (mock tempatan). Perlu Supabase LOCAL.
// Mula app (kunci Resend palsu, URL mock):
//   RESEND_API_KEY=re_test EMAIL_FROM="Uji <uji@mail.test>" RESEND_API_URL=http://127.0.0.1:4010/emails CRON_SECRET=cron-rahsia-ujian-1234567 \
//   BAYARCASH_PAT=x BAYARCASH_PORTAL_KEY=x BAYARCASH_SECRET_KEY=test-secret-bukan-kunci-sebenar STORAGE_DRIVER=local npx next dev -H 127.0.0.1 -p 3101
// Guna: node --env-file=.env.local scripts/test-email.mjs     Bersihkan: supabase/tests/cleanup-email-data.sql
import { createClient } from "@supabase/supabase-js";
import { createChecksumValue } from "bayarcash";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101", CRON = "cron-rahsia-ujian-1234567", SECRET = "test-secret-bukan-kunci-sebenar";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };

const mails = []; let failNext = false;
const mock = createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  if (failNext) { failNext = false; res.writeHead(500, { "content-type": "application/json" }); return res.end('{"message":"x"}'); }
  mails.push({ auth: req.headers.authorization, idem: req.headers["idempotency-key"], ...JSON.parse(b) }); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ id: "m_" + mails.length })); }); }).listen(4010, "127.0.0.1");

const tag = randomBytes(2).toString("hex");
const mk = async (n) => (await db.auth.admin.createUser({ email: `em-${tag}-${n}@test.local`, password: randomBytes(10).toString("hex"), email_confirm: true, user_metadata: { privacy_accepted: true, full_name: `Ujian Emel ${n}` } })).data.user;
const { data: course } = await db.from("courses").select("id, price").order("created_at").limit(1).single();
const day = 864e5;
const enr = async (u, endsIn, createdAgo) => (await db.from("enrollments").insert({ user_id: u.id, course_id: course.id, access_ends_at: new Date(Date.now() + endsIn * day).toISOString(), created_at: new Date(Date.now() - createdAgo * day).toISOString() }).select("id").single()).data;
const cron = (auth) => fetch(BASE + "/api/cron/reminders", { method: "POST", headers: auth ? { authorization: auth } : {} });

try {
  ok((await cron()).status === 401, "cron tanpa rahsia = 401");
  ok((await cron("Bearer salah")).status === 401, "cron rahsia salah = 401");
  ok((await fetch(BASE + "/api/cron/reminders")).status === 405, "GET tidak dibenarkan (405)");

  // pelajar: A akses tinggal 20 hari (akses_30), B akses tinggal 100 hari tapi sudah 20 hari tiada aktiviti
  const A = await mk("a"), B = await mk("b"), C = await mk("c");
  const eA = await enr(A, 20, 1), eB = await enr(B, 100, 20), eC = await enr(C, 100, 1);
  mails.length = 0;
  let r = await cron(`Bearer ${CRON}`), j = await r.json();
  ok(r.status === 200 && j.ok, "cron sah = 200");
  const to = (e) => mails.filter((m) => m.to[0].includes(e));
  const mA = to(`em-${tag}-a@`), mB = to(`em-${tag}-b@`), mC = to(`em-${tag}-c@`);
  ok(mA.length === 1 && /hampir tamat/.test(mA[0].subject) && /20 hari/.test(mA[0].text), "A: emel akses_30");
  ok(mB.length === 1 && /belum sambung/.test(mB[0].subject), "B: emel tiada aktiviti");
  ok(mC.length === 0, "C (aktif, akses panjang): tiada emel");
  ok(mA[0].auth === "Bearer re_test" && mA[0].idem === `rem-${eA.id}-akses_30` && mA[0].from.includes("uji@mail.test"), "pengepala Resend: kunci, Idempotency-Key, from");
  ok(!/pendawaian|kompeten/i.test(mA[0].text + mB[0].text), "tiada kandungan pendawaian/kompetensi");
  const { count } = await db.from("reminders").select("id", { count: "exact", head: true }).in("enrollment_id", [eA.id, eB.id, eC.id]);
  ok(count === 2, "2 baris reminders direkod");

  mails.length = 0; await cron(`Bearer ${CRON}`);
  ok(to(`em-${tag}-`).length === 0 || mails.filter((m) => /em-/.test(m.to[0]) && m.to[0].includes(tag)).length === 0, "jalan kali ke-2: tiada emel berulang");

  // kegagalan Resend: tiada baris reminders (akan dicuba semula esok)
  const D = await mk("d"); const eD = await enr(D, 3, 1); mails.length = 0; failNext = true;
  j = await (await cron(`Bearer ${CRON}`)).json();
  ok(j.failed >= 1 && !(await db.from("reminders").select("id").eq("enrollment_id", eD.id)).data.length, "emel gagal: tiada rekod reminders, dicuba semula");
  mails.length = 0; await cron(`Bearer ${CRON}`);
  ok(mails.filter((m) => m.to[0].includes(`${tag}-d@`) && /seminggu/.test(m.subject)).length === 1, "cuba semula berjaya: emel akses_7");

  // resit: callback sah -> satu resit; callback diulang -> tiada resit kedua
  const E = await mk("e"); const FIELDS = ["record_type","transaction_id","exchange_reference_number","exchange_transaction_id","order_number","currency","amount","payer_name","payer_email","payer_bank_name","status","status_description","datetime"];
  const ord = (await db.from("orders").insert({ user_id: E.id, course_id: course.id, order_number: `EM${tag}`.toUpperCase(), amount: course.price, terms_accepted_at: new Date().toISOString() }).select("order_number").single()).data;
  const d = { record_type: "transaction", transaction_id: "trx_" + randomBytes(3).toString("hex"), exchange_reference_number: "BPG1", exchange_transaction_id: "x1", order_number: ord.order_number, currency: "MYR", amount: (course.price / 100).toFixed(2), payer_name: "U", payer_email: "u@t.local", payer_bank_name: "B", status: "3", status_description: "Successful", datetime: "2026-10-27 02:14:06" };
  const signed = { ...d, checksum: createChecksumValue(SECRET, Object.fromEntries(FIELDS.map((k) => [k, d[k]]))) };
  mails.length = 0;
  const post = () => fetch(BASE + "/api/bayarcash/callback", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(signed).toString() }).then((x) => x.status);
  ok(await post() === 200, "callback sah = 200");
  const rc = mails.filter((m) => m.to[0].includes(`${tag}-e@`));
  ok(rc.length === 1 && rc[0].subject.includes(ord.order_number) && rc[0].text.includes("149.00") && rc[0].text.includes("/dashboard"), "resit: no. order, jumlah RM149.00, pautan dashboard");
  await post(); await post();
  ok(mails.filter((m) => m.to[0].includes(`${tag}-e@`)).length === 1, "callback diulang 3 kali: hanya satu resit");
} finally { mock.close(); }
console.log(fail ? `\n${fail} GAGAL` : "\nSemua lulus"); process.exit(fail ? 1 : 0);
