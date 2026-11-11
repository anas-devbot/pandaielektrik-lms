// Ujian route /api/bayarcash/callback terhadap app yang berjalan dengan BAYARCASH_SECRET_KEY = TEST_SECRET (BUKAN kunci produksi).
// Mula app: BAYARCASH_PAT=x BAYARCASH_PORTAL_KEY=x BAYARCASH_SECRET_KEY=test-secret-bukan-kunci-sebenar npx next dev -H 127.0.0.1 -p 3101
// Guna: node --env-file=.env.local scripts/test-callback.mjs
import { createClient } from "@supabase/supabase-js";
import { createChecksumValue } from "bayarcash";
import { randomBytes } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101", SECRET = "test-secret-bukan-kunci-sebenar";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };

const FIELDS = ["record_type","transaction_id","exchange_reference_number","exchange_transaction_id","order_number","currency",
  "amount","payer_name","payer_email","payer_bank_name","status","status_description","datetime"];
const PRE = ["record_type", "exchange_reference_number", "order_number"];
const sign = (d, f) => ({ ...d, checksum: createChecksumValue(SECRET, Object.fromEntries(f.map((k) => [k, d[k]]))) });
const tx = (o) => sign({ record_type: "transaction", transaction_id: "trx_" + randomBytes(3).toString("hex"), exchange_reference_number: "BPG1",
  exchange_transaction_id: "x1", currency: "MYR", amount: "149.00", payer_name: "U", payer_email: "u@t.local", payer_bank_name: "Bank",
  status: "3", status_description: "Successful", datetime: "2026-10-27 02:14:06", payment_gateway_id: "1", payment_intent_id: "pi_X", ...o }, FIELDS);
const post = (body, json = false) => fetch(BASE + "/api/bayarcash/callback", { method: "POST", redirect: "manual",
  headers: { "content-type": json ? "application/json" : "application/x-www-form-urlencoded" },
  body: json ? JSON.stringify(body) : new URLSearchParams(body).toString() }).then((r) => r.status);

const tag = randomBytes(3).toString("hex");
const { data: course } = await db.from("courses").select("id, price").limit(1).single();
const { data: u, error: ue } = await db.auth.admin.createUser({ email: `cb-${tag}@test.local`, password: randomBytes(10).toString("hex"),
  email_confirm: true, user_metadata: { privacy_accepted: true, phone: "0123456789", full_name: "CB" } });
if (ue) throw ue;
const mkOrder = async (n, amount = course.price) => (await db.from("orders").insert({ user_id: u.user.id, course_id: course.id,
  order_number: `T${tag}${n}`.toUpperCase(), amount, terms_accepted_at: new Date().toISOString() }).select("id, order_number").single()).data;
const state = async (id) => (await db.from("orders").select("status").eq("id", id).single()).data.status;
const enrolls = async () => (await db.from("enrollments").select("id").eq("user_id", u.user.id)).data.length;
const events = async (n) => (await db.from("payment_events").select("id").eq("order_number", n)).data.length;

try {
  const o1 = await mkOrder(1);
  const forged = { ...tx({ order_number: o1.order_number }), checksum: "0".repeat(64) };
  ok(await post(forged) === 403 && await state(o1.id) === "pending", "checksum palsu = 403, order kekal pending");
  const tampered = { ...tx({ order_number: o1.order_number, amount: "1.00" }), amount: "149.00" }; // checksum untuk amaun lain
  ok(await post(tampered) === 403 && await state(o1.id) === "pending", "amaun diubah selepas tandatangan = 403");
  ok(await post({ record_type: "transaction", status: "3", order_number: o1.order_number }) === 403, "tiada checksum = 403");

  const good = tx({ order_number: o1.order_number });
  const codes = [await post(good), await post(good), await post(good)];
  ok(codes.every((c) => c === 200), "callback sah 3 kali = 200 setiap kali");
  ok(await state(o1.id) === "paid" && await enrolls() === 1 && await events(o1.order_number) === 1, "satu paid, satu enrollment, satu peristiwa");

  const o2 = await mkOrder(2);
  const t2 = "trx_" + randomBytes(3).toString("hex");
  ok(await post(tx({ order_number: o2.order_number, transaction_id: t2, status: "2", status_description: "Unsuccessful" })) === 200 && await state(o2.id) === "pending", "status 2 = 200 tetapi tidak paid");
  ok(await post(tx({ order_number: o2.order_number, transaction_id: t2, status: "4" })) === 200 && await state(o2.id) === "pending", "status 4 tidak paid");
  ok(await post(tx({ order_number: o2.order_number, amount: "1.00" })) === 200 && await state(o2.id) === "pending", "amaun salah (RM1) tidak paid");
  ok(await post(tx({ order_number: o2.order_number, currency: "USD" })) === 200 && await state(o2.id) === "pending", "mata wang salah tidak paid");
  ok(await post(tx({ order_number: "TAKADA" + tag })) === 200, "order tak dikenali = 200 (dicatat, tiada kesan)");
  ok(await post(tx({ order_number: o2.order_number }), true) === 200 && await state(o2.id) === "paid", "badan JSON diterima, order kedua paid");
  ok(await enrolls() === 1, "pelajar masih satu enrollment (unique user+course)");

  const pre = sign({ record_type: "pre_transaction", exchange_reference_number: "BPG2", order_number: o2.order_number }, PRE);
  ok(await post(pre) === 200, "pre_transaction sah = 200");
  ok(await post({ ...pre, checksum: "0".repeat(64) }) === 403, "pre_transaction checksum palsu = 403");
  ok(await post({ record_type: "lain" }) === 200, "record_type lain diabaikan = 200");
  const bad = await fetch(BASE + "/api/bayarcash/callback", { method: "POST", headers: { "content-type": "application/json" }, body: "{bukan json" });
  ok(bad.status === 400, "JSON rosak = 400");
  const get = await fetch(BASE + "/api/bayarcash/callback"); ok(get.status === 405, "GET = 405");
} finally {
  // payment_events append-only: data ujian dibuang oleh supabase/tests/cleanup-test-data.sql (local sahaja).
  await db.from("enrollments").delete().eq("user_id", u.user.id);
  console.log("bersihkan: jalankan supabase/tests/cleanup-test-data.sql");
}
console.log(fail ? `${fail} GAGAL` : "semua lulus"); process.exit(fail ? 1 : 0);
