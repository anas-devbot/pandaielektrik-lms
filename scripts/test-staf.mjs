// Ujian e2e modul Staf (HTTP): akses halaman dan senarai. Tindakan (tambah/ubah/nyahaktif) diuji dalam supabase/tests/admin_staf.sql dan semakan UI.
// Perlu app (BASE_URL :3101) + Supabase LOCAL. Bersihkan: supabase/tests/cleanup-staf-data.sql
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomBytes } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101", PW = "UjiLocal-Staf-9vKm";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };
const tag = randomBytes(2).toString("hex");

const mk = async (n, role) => {
  if (role) await db.from("staff_invites").insert({ email: `sf-${n}-${tag}@test.local`, role });
  return (await db.auth.admin.createUser({ email: `sf-${n}-${tag}@test.local`, password: PW, email_confirm: true, user_metadata: { privacy_accepted: true, phone: "0123456789", full_name: `Ujian Staf ${n} ${tag}` } })).data.user;
};
const [S, REV, APR, ADM] = [await mk("pel"), await mk("rev", "reviewer"), await mk("apr", "approver"), await mk("adm", "admin")];

async function cookieFor(email) {
  const jar = new Map();
  const sb = createServerClient(URL_, KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PW }); if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const get = async (p, c) => { const r = await fetch(BASE + p, { redirect: "manual", headers: c ? { cookie: c } : {} }); return { s: r.status, t: (await r.text()).replace(/<!-- -->/g, "") }; };
const [cS, cR, cP, cA] = await Promise.all([S, REV, APR, ADM].map((u) => cookieFor(u.email)));

ok((await get("/admin/staf")).s === 307, "tetamu /admin/staf -> log masuk");
ok((await get("/admin/staf", cS)).s === 307, "pelajar ditolak");
ok((await get("/admin/staf", cR)).s === 307, "reviewer ditolak");
ok((await get("/admin/staf", cP)).s === 307, "approver ditolak (admin sahaja)");
const r = await get("/admin/staf", cA);
ok(r.s === 200, "admin /admin/staf 200");
ok(r.t.includes(`Ujian Staf rev ${tag}`) && r.t.includes(`sf-rev-${tag}@test.local`) && r.t.includes(`Ujian Staf apr ${tag}`), "senarai memaparkan nama dan emel staf");
ok(r.t.includes("log masuk terakhir") && r.t.includes("Tambah staf"), "log masuk terakhir dan borang tambah wujud");
ok(!r.t.includes(`Ujian Staf pel ${tag}`), "pelajar tidak disenaraikan sebagai staf");
ok(/\(anda\)/.test(r.t) && r.t.includes("Anda tidak boleh mengubah akaun sendiri"), "admin sendiri ditanda dan tiada tindakan pada diri sendiri");
ok(r.t.includes("/admin/staf") && (await get("/admin", cA)).t.includes("Staf"), "navigasi memaparkan modul Staf");

console.log(fail ? `${fail} GAGAL` : "semua lulus");
process.exit(fail ? 1 : 0);
