// Ujian e2e slice 9 (HTTP): halaman praktikal, notis "Jangan masukkan bekalan", kebenaran bekalan tidak bocor, kawalan peranan.
// Mula app: STORAGE_DRIVER=local npx next dev -H 127.0.0.1 -p 3101
// Guna: node --env-file=.env.local scripts/test-practical.mjs [--keep]   Bersihkan: supabase/tests/cleanup-practical-data.sql
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101", PW = "UjiLocal-Prak-6xQz";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };
const GUIDE = "PANDUAN-KESELAMATAN-AHZ-UJI-" + Math.random().toString(36).slice(2, 8);

const mk = async (n, role) => {
  if (role) await db.from("staff_invites").insert({ email: `pk-${n}@test.local`, role });
  return (await db.auth.admin.createUser({ email: `pk-${n}@test.local`, password: PW, email_confirm: true, user_metadata: { privacy_accepted: true, full_name: `Ujian Praktikal ${n}` } })).data.user;
};
const [S, S2, S3, R1, APR, ADM] = [await mk("s1"), await mk("s2"), await mk("s3"), await mk("r1", "reviewer"), await mk("apr", "approver"), await mk("adm", "admin")];
const { data: course } = await db.from("courses").select("id, config").order("created_at").limit(1).single();
await db.from("courses").update({ config: { ...course.config, energize_guidance_text: GUIDE } }).eq("id", course.id);
const far = new Date(Date.now() + 90 * 864e5).toISOString();
const enr = async (u, stage, track) => (await db.from("enrollments").insert({ user_id: u.id, course_id: course.id, stage, cert_track: track ?? null, access_ends_at: far }).select("id").single()).data;
const eS = await enr(S, "practical", "theory_practical"); await enr(S2, "enrolled"); await enr(S3, "theory_passed");

async function cookieFor(email) {
  const jar = new Map();
  const sb = createServerClient(URL_, KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PW }); if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const get = async (p, c) => { const r = await fetch(BASE + p, { redirect: "manual", headers: c ? { cookie: c } : {} }); return { s: r.status, loc: r.headers.get("location") ?? "", t: r.headers.get("content-type")?.includes("image") ? "" : (await r.text()).replace(/<!-- -->/g, "") }; };
const [cS, cS2, cS3, cR, cA, cAdm] = await Promise.all([S, S2, S3, R1, APR, ADM].map((u) => cookieFor(u.email)));
const WAIT = "Menunggu pengesahan AHZ. Jangan masukkan bekalan.";
const rpc = (n, a) => db.rpc(n, a);

// fail borang sebenar dalam storan local
const root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".local-storage"), fkey = `submissions/${eS.id}/form-fixture.jpg`;
mkdirSync(path.dirname(path.join(root, fkey)), { recursive: true }); copyFileSync("scripts/fixtures/foto-exif.jpg", path.join(root, fkey));

let r = await get("/praktikal", cS2); ok(r.s === 307 && r.loc.endsWith("/dashboard"), "pelajar bukan trek praktikal: /praktikal -> /dashboard");
r = await get("/dashboard", cS3); ok(r.t.includes("Pilih trek") && r.t.includes("Pilih trek teori dan praktikal"), "dashboard: pelajar teori lulus nampak pilihan trek");
r = await get("/praktikal"); ok(r.s === 307 && r.loc.includes("/log-masuk"), "tetamu /praktikal -> log masuk");

r = await get("/praktikal", cS);
ok(r.s === 200 && r.t.includes(WAIT), "awal: notis 'Jangan masukkan bekalan' dipaparkan");
ok(!r.t.includes("telah direkodkan oleh AHZ") && !r.t.includes(GUIDE), "awal: TIADA teks kebenaran atau panduan");
ok(r.t.includes('name="form"') && !r.t.includes('name="ref"'), "awal: borang dimuat naik ada, deklarasi video belum (borang dahulu)");

const { data: f1 } = await rpc("submit_practical", { p_enrollment: eS.id, p_type: "form", p_file_key: fkey, p_external_ref: null, p_consent: null });
r = await get("/praktikal", cS); ok(r.t.includes('name="ref"') && r.t.includes("Notis privasi Telegram group"), "selepas borang: deklarasi video + notis privasi Telegram dipaparkan");
ok(r.t.includes("semua ahli group") || r.t.includes("Semua ahli group"), "notis privasi sebut semua ahli group nampak video");
const { data: v1 } = await rpc("submit_practical", { p_enrollment: eS.id, p_type: "video", p_file_key: null, p_external_ref: "Telegram 27/10 10:30", p_consent: true });
r = await get("/praktikal", cS); ok(r.t.includes("Menunggu semakan") && r.t.includes("Telegram 27/10 10:30") && r.t.includes(WAIT), "video diisytihar: menunggu semakan, notis kekal");

// akses halaman staf
r = await get("/staff/praktikal/" + eS.id, cS); ok(r.s === 307, "pelajar tak boleh buka halaman semakan praktikal");
r = await get("/staff/praktikal/" + eS.id, cR); ok(r.s === 200 && r.t.includes("Tuntut untuk semak") && !r.t.includes("Luluskan kebenaran memasukkan bekalan"), "reviewer: boleh tuntut, TIADA butang kelulusan bekalan");
r = await get("/staff", cR); ok(r.t.includes("Ujian Praktikal s1") && r.t.includes("semak borang + video"), "queue: item praktikal dipaparkan");
await rpc("claim_practical", { p_enrollment: eS.id, p_reviewer: R1.id });
r = await get("/staff/praktikal/" + eS.id, cR); ok(r.t.includes('name="decision"') && r.t.includes("Telegram 27/10 10:30") && r.t.includes(`/api/submissions/${f1}/file`), "reviewer selepas tuntut: borang keputusan, rujukan video, imej borang");
await rpc("review_practical_item", { p_submission: f1, p_reviewer: R1.id, p_decision: "approved", p_comment: null });
await rpc("review_practical_item", { p_submission: v1, p_reviewer: R1.id, p_decision: "approved", p_comment: null });

// semakan reviewer SAHAJA bukan kebenaran
r = await get("/praktikal", cS); ok(r.t.includes(WAIT) && !r.t.includes("telah direkodkan oleh AHZ") && !r.t.includes(GUIDE), "reviewer terima borang+video: pelajar MASIH 'Jangan masukkan bekalan' (bukan kebenaran)");
r = await get("/staff", cA); ok(r.t.includes("menunggu kelulusan bekalan"), "queue approver: menunggu kelulusan bekalan");
r = await get("/staff/praktikal/" + eS.id, cR); ok(!r.t.includes("Luluskan kebenaran memasukkan bekalan") && r.t.includes("Hanya <b>approver</b>"), "reviewer: tiada butang kelulusan, hanya mesej approver");
r = await get("/staff/praktikal/" + eS.id, cAdm); ok(!r.t.includes("Luluskan kebenaran memasukkan bekalan"), "admin: tiada butang kelulusan bekalan");
r = await get("/staff/praktikal/" + eS.id, cA); ok(r.t.includes("Luluskan kebenaran memasukkan bekalan") && r.t.includes(GUIDE), "approver: butang kelulusan + teks panduan AHZ dipratonton");

// kelulusan (manual, approver) -> pelajar nampak kebenaran + teks panduan rekod
await rpc("approve_energize", { p_actor: APR.id, p_enrollment: eS.id, p_video: v1 });
r = await get("/praktikal", cS);
ok(r.t.includes("Kebenaran memasukkan bekalan telah direkodkan oleh AHZ") && r.t.includes(GUIDE) && !r.t.includes(WAIT), "selepas kelulusan approver: kebenaran + panduan dipaparkan, notis menunggu hilang");
r = await get("/staff", cR); ok(r.t.includes("menunggu keputusan praktikal"), "queue: menunggu keputusan praktikal");

// hantar semula -> kembali tanpa kebenaran
await rpc("submit_practical", { p_enrollment: eS.id, p_type: "video", p_file_key: null, p_external_ref: "rakaman baharu Telegram", p_consent: true });
r = await get("/praktikal", cS);
ok(r.t.includes(WAIT) && !r.t.includes("telah direkodkan oleh AHZ") && !r.t.includes(GUIDE), "VIDEO DIHANTAR SEMULA: kebenaran lenyap, notis 'Jangan masukkan bekalan' kembali");
const { data: e1 } = await db.from("enrollments").select("energize_approved_at, approved_submission_id").eq("id", eS.id).single();
ok(e1.energize_approved_at === null && e1.approved_submission_id === null, "DB: kebenaran dibatalkan automatik");
const { count: cancels } = await db.from("admin_actions").select("*", { count: "exact", head: true }).eq("enrollment_id", eS.id).eq("action", "energize_cancelled");
ok(cancels === 1, "admin_actions: satu pembatalan direkod");
r = await get("/staff/praktikal/" + eS.id, cA); ok(!r.t.includes("Luluskan kebenaran memasukkan bekalan"), "approver: tiada butang bila video baharu belum disemak");
const act = await db.from("admin_actions").select("detail").eq("enrollment_id", eS.id).eq("action", "energize_approval").single();
ok(act.data?.detail?.guidance_text === GUIDE, "admin_actions: teks panduan yang direkod = teks AHZ pada masa kelulusan");

// fail borang
const fileR = (c) => fetch(`${BASE}/api/submissions/${f1}/file`, { headers: c ? { cookie: c } : {} }).then((x) => x.status);
ok(await fileR(cS) === 200 && await fileR(cS2) === 404 && await fileR(cR) === 200 && await fileR() === 401, "fail borang: pemilik 200, pelajar lain 404, penilai 200, tetamu 401");
r = await get("/dashboard", cS); ok(r.t.includes("/praktikal"), "dashboard: pautan halaman praktikal");
console.log(JSON.stringify({ student: S.email, student3: S3.email, reviewer: R1.email, approver: APR.email, admin: ADM.email, password: PW, guidance: GUIDE, enrollment: eS.id }));
console.log(fail ? `${fail} GAGAL` : "semua lulus"); process.exit(fail ? 1 : 0);
