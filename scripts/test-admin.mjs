// Ujian e2e slice 12 (HTTP): akses halaman admin, senarai tersangkut, pelajar, kursus. Perlu app (BASE_URL :3101) + Supabase LOCAL.
// Mula app: STORAGE_DRIVER=local npx next dev -H 127.0.0.1 -p 3101    Bersihkan: supabase/tests/cleanup-admin-data.sql
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101", PW = "UjiLocal-Admin-7vKm";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };

const mk = async (n, role) => {
  if (role) await db.from("staff_invites").insert({ email: `ad-${n}@test.local`, role });
  return (await db.auth.admin.createUser({ email: `ad-${n}@test.local`, password: PW, email_confirm: true, user_metadata: { privacy_accepted: true, full_name: `Ujian Admin ${n}` } })).data.user;
};
const [S1, S2, REV, ADM, APR] = [await mk("s1"), await mk("s2"), await mk("rev", "reviewer"), await mk("adm", "admin"), await mk("apr", "approver")];
const { data: course } = await db.from("courses").select("id").order("created_at").limit(1).single();
const day = 864e5;
const enr = async (u, endsInDays, createdAgoDays) => (await db.from("enrollments").insert({ user_id: u.id, course_id: course.id, access_ends_at: new Date(Date.now() + endsInDays * day).toISOString(), created_at: new Date(Date.now() - createdAgoDays * day).toISOString() }).select("id").single()).data;
const e1 = await enr(S1, 5, 20), e2 = await enr(S2, 100, 20);   // S1: akses_7 + tiada_aktiviti; S2: tiada_aktiviti sahaja

async function cookieFor(email) {
  const jar = new Map();
  const sb = createServerClient(URL_, KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PW }); if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const get = async (p, c) => { const r = await fetch(BASE + p, { redirect: "manual", headers: c ? { cookie: c } : {} }); return { s: r.status, t: (await r.text()).replace(/<!-- -->/g, "") }; };
const [cS, cR, cA, cP] = await Promise.all([S1, REV, ADM, APR].map((u) => cookieFor(u.email)));

const pages = ["/admin", "/admin/queue", "/admin/bekalan", "/admin/pelajar", `/admin/pelajar/${e1.id}`, "/admin/kursus", "/admin/refund"];
for (const p of pages) {
  ok((await get(p)).s === 307, `tetamu ${p} -> log masuk`);
  ok((await get(p, cS)).s === 307, `pelajar ${p} ditolak`);
  ok((await get(p, cR)).s === 307, `reviewer ${p} ditolak`);
  ok((await get(p, cP)).s === 307, `approver ${p} ditolak (admin sahaja)`);
  const r = await get(p, cA); ok(r.s === 200, `admin ${p} 200`);
}

let r = await get("/admin", cA);
ok(r.t.includes("Ujian Admin s1") && r.t.includes("Ujian Admin s2"), "Menunggu tindakan: senarai tersangkut memuat S1 dan S2");
ok(r.t.includes("Salin mesej") && /DRAF/.test(r.t), "templat mesej WhatsApp (DRAF) + butang salin");
ok(!r.t.includes("ad-s1@test.local".replace("ad-s1", "SERVICE")), "tiada kebocoran rahsia");

r = await get(`/admin/pelajar?q=${encodeURIComponent("ad-s2@test.local")}`, cA);
ok(r.t.includes(`/admin/pelajar/${e2.id}`) && !r.t.includes(`/admin/pelajar/${e1.id}`), "carian emel menjumpai S2 sahaja");
r = await get(`/admin/pelajar?q=${encodeURIComponent("Ujian Admin s1")}`, cA);
ok(r.t.includes(`/admin/pelajar/${e1.id}`), "carian nama menjumpai S1");
r = await get(`/admin/pelajar?q=${encodeURIComponent("%' or 1=1 --")}`, cA); ok(r.s === 200 && !r.t.includes(`/admin/pelajar/${e1.id}`), "carian dengan aksara khas selamat");
r = await get(`/admin/pelajar/${e1.id}`, cA); ok(r.t.includes("Lanjut tempoh akses") && r.t.includes("Log tindakan") && r.t.includes("ad-s1@test.local"), "butiran pelajar: borang tindakan, log, emel");
r = await get("/admin/pelajar/bukan-uuid", cA); ok(r.s === 404, "id tidak sah -> 404");
r = await get("/admin/pelajar/00000000-0000-0000-0000-000000000000", cA); ok(r.s === 404, "id tiada -> 404");
r = await get("/admin/kursus", cA); ok(r.t.includes("Sesi kursus live") && r.t.includes("Polisi dan teks") && r.t.includes("Tambah sesi"), "halaman kursus: sesi + polisi");

// tindakan terus lewat RPC (UI dilitupi ujian pelayar): pelaku bukan admin ditolak
const { error: er } = await db.rpc("extend_access", { p_actor: REV.id, p_enrollment: e1.id, p_days: 10, p_reason: "x" });
ok(!!er, "extend_access oleh reviewer ditolak di DB");

console.log(fail ? `\n${fail} GAGAL` : "\nSemua lulus"); process.exit(fail ? 1 : 0);
