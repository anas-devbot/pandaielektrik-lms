// Ujian e2e slice 7 (HTTP): kawalan akses halaman + laluan fail. Muat naik/aliran borang diuji melalui pelayar (lihat laporan).
// Mula app: STORAGE_DRIVER=local npx next dev -H 127.0.0.1 -p 3101
// Guna: node --env-file=.env.local scripts/test-part2.mjs [--keep]   (--keep = tinggalkan data untuk ujian pelayar)
// Bersihkan: supabase/tests/cleanup-part2-data.sql
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101", PW = "UjiLocal-Part2-8xQz";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };

const mk = async (n, role) => {
  if (role) await db.from("staff_invites").insert({ email: `p2-${n}@test.local`, role });
  return (await db.auth.admin.createUser({ email: `p2-${n}@test.local`, password: PW, email_confirm: true, user_metadata: { privacy_accepted: true, phone: "0123456789", full_name: `P2 ${n}` } })).data.user;
};
const [S, S2, R1, R2, ADM] = [await mk("s1"), await mk("s2"), await mk("r1", "reviewer"), await mk("r2", "reviewer"), await mk("adm", "admin")];
const { data: course } = await db.from("courses").select("id").order("created_at").limit(1).single();
const far = new Date(Date.now() + 90 * 864e5).toISOString();
const enr = async (u, stage) => (await db.from("enrollments").insert({ user_id: u.id, course_id: course.id, stage, access_ends_at: far }).select("id").single()).data;
const eS = await enr(S, "part2_review"), eS2 = await enr(S2, "enrolled");

async function cookieFor(email) {
  const jar = new Map();
  const sb = createServerClient(URL_, KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PW }); if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const get = async (p, c) => { const r = await fetch(BASE + p, { redirect: "manual", headers: c ? { cookie: c } : {} }); return { s: r.status, loc: r.headers.get("location") ?? "", ct: r.headers.get("content-type") ?? "", cc: r.headers.get("cache-control") ?? "", t: r.headers.get("content-type")?.includes("image") ? "" : await r.text() }; };
const [cS, cS2, cR1, cR2, cA] = await Promise.all([S, S2, R1, R2, ADM].map((u) => cookieFor(u.email)));

// data: satu skematik tersimpan (fail sebenar dalam storan local) + satu subjektif menunggu
const key = `submissions/${eS.id}/schematic-fixture.jpg`;
const root = path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".local-storage");
mkdirSync(path.dirname(path.join(root, key)), { recursive: true });
copyFileSync("scripts/fixtures/foto-exif.jpg", path.join(root, key));
const { data: subj } = await db.rpc("submit_part2", { p_enrollment: eS.id, p_type: "subjective", p_text: "Jawapan ujian", p_file_key: null });
const { data: sch } = await db.rpc("submit_part2", { p_enrollment: eS.id, p_type: "schematic", p_text: null, p_file_key: key });

// laluan fail
let r = await get(`/api/submissions/${sch}/file`); ok(r.s === 401, "fail skematik tanpa log masuk = 401");
r = await get(`/api/submissions/${sch}/file`, cS); ok(r.s === 200 && r.ct.includes("image/jpeg") && r.cc.includes("no-store"), "pemilik boleh lihat fail (JPEG, no-store)");
r = await get(`/api/submissions/${sch}/file`, cS2); ok(r.s === 404, "pelajar lain: 404 (kewujudan tak didedahkan)");
r = await get(`/api/submissions/${sch}/file`, cR1); ok(r.s === 200, "penilai boleh lihat fail");
r = await get(`/api/submissions/${subj}/file`, cR1); ok(r.s === 404, "item subjektif tiada fail = 404");
// halaman pelajar
r = await get("/bahagian2", cS2); ok(r.s === 200 && r.t.includes("dibuka selepas ujian akhir lulus") && !r.t.includes('name="subjective"'), "pelajar belum lulus MCQ: bahagian 2 tertutup, tiada borang");
r = await get("/bahagian2", cS); ok(r.s === 200 && r.t.includes("Menunggu semakan") && !r.t.includes('name="subjective"'), "pelajar S: kedua-dua pending, borang tidak dipaparkan");
r = await get("/dashboard", cS); ok(r.t.includes("/bahagian2"), "dashboard S: pautan bahagian 2");
// akses peranan
r = await get("/staff", cS); ok(r.s === 307 && r.loc.endsWith("/dashboard"), "pelajar /staff -> /dashboard");
r = await get("/staff", cR1); ok(r.s === 200 && r.t.includes("P2 s1"), "penilai nampak pelajar S dalam queue");
r = await get("/staff", cA); ok(r.s === 200, "admin boleh akses queue");
r = await get("/admin", cR1); ok(r.s === 307 && r.loc.endsWith("/staff"), "penilai /admin -> /staff");
r = await get("/admin/pelajar", cA); ok(r.s === 200 && r.t.includes("Tambah percubaan") && r.t.includes("Rekod penghantaran manual"), "admin nampak dua tindakan");
// tuntut tugasan dan papar
r = await get(`/staff/semak/${eS.id}`, cR1); ok(r.t.includes("Tuntut untuk semak") && !r.t.includes('name="decision"'), "belum dituntut: ada butang tuntut, tiada borang keputusan");
await db.rpc("claim_review", { p_enrollment: eS.id, p_reviewer: R1.id });
r = await get(`/staff/semak/${eS.id}`, cR1); ok(r.t.includes('name="decision"') && r.t.includes("Jawapan ujian") && r.t.includes(`/api/submissions/${sch}/file`), "R1 selepas tuntut: borang keputusan, jawapan dan imej");
r = await get(`/staff/semak/${eS.id}`, cR2); ok(r.t.includes("dipegang penilai lain") && !r.t.includes('name="decision"') && !r.t.includes("Tuntut untuk semak"), "R2: item dipegang R1, tiada tuntut / keputusan");
r = await get("/staff", cR2); ok(r.t.includes("oleh P2 r1"), "queue R2 papar pemegang tuntutan");
r = await get(`/staff/semak/${eS.id}`, cS); ok(r.s === 307, "pelajar tak boleh buka halaman semakan");
r = await get(`/staff/semak/${eS.id}`); ok(r.s === 307 && r.loc.includes("/log-masuk"), "tetamu -> /log-masuk");
console.log(JSON.stringify({ student: S.email, reviewer1: R1.email, reviewer2: R2.email, admin: ADM.email, student2: S2.email, password: PW, enrollment: eS.id, enrollment2: eS2.id }));
console.log(fail ? `${fail} GAGAL` : "semua lulus"); process.exit(fail ? 1 : 0);
