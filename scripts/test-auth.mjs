// Ujian hujung-ke-hujung auth terhadap Supabase LOCAL + app yang sedang berjalan (BASE_URL, default :3101).
// Guna: node --env-file=.env.local scripts/test-auth.mjs   (akaun ujian dicipta rawak dan dipadam di hujung)
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomBytes } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya untuk Supabase LOCAL"); process.exit(2); }
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };

const tag = randomBytes(4).toString("hex"), pw = randomBytes(12).toString("hex");
const users = {};
for (const role of ["reviewer", "approver", "admin"]) {
  const email = `t-${role}-${tag}@test.local`;
  const inv = await admin.from("staff_invites").insert({ email, role });
  if (inv.error) throw inv.error;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: pw, email_confirm: true, user_metadata: { full_name: `Uji ${role}` },
  });
  if (error) throw error; users[role] = { id: data.user.id, email: data.user.email };
}

try {
  // daftar terus ke API auth tanpa persetujuan privasi (memintas borang kita)
  const bad = await anon.auth.signUp({ email: `t-nopriv-${tag}@test.local`, password: pw });
  ok(!!bad.error && !bad.data.session, "signUp terus tanpa privasi ditolak oleh DB");
  // daftar sah + cubaan eskalasi peranan melalui metadata
  const good = await anon.auth.signUp({ email: `t-student-${tag}@test.local`, password: pw,
    options: { data: { full_name: "Uji pelajar", phone: "0123456789", privacy_accepted: true, privacy_version: "uji", role: "admin" } } });
  ok(!good.error, "signUp sah berjaya");
  users.student = { id: good.data.user?.id, email: `t-student-${tag}@test.local` };
  const { data: prof } = await admin.from("profiles").select("role, privacy_accepted_at").eq("id", users.student.id).single();
  ok(prof?.role === "student" && !!prof.privacy_accepted_at, "pelajar baharu = student (role dalam metadata diabaikan), privasi direkod");

  // sesi sebenar melalui cookie @supabase/ssr, kemudian minta halaman
  async function cookieFor(email) {
    const jar = new Map();
    const sb = createServerClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) throw error;
    return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  const get = async (path, cookie) => {
    const r = await fetch(BASE + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
    return { status: r.status, loc: r.headers.get("location") ?? "" };
  };
  for (const p of ["/dashboard", "/staff", "/admin"]) {
    const r = await get(p);
    ok(r.status === 307 && r.loc.includes("/log-masuk"), `tetamu ${p} -> /log-masuk`);
  }
  const matrix = {
    student:  { "/dashboard": 200, "/staff": "/dashboard", "/admin": "/dashboard" },
    reviewer: { "/dashboard": "/staff", "/staff": 200, "/admin": "/staff" },
    approver: { "/dashboard": "/staff", "/staff": 200, "/admin": "/staff" },
    admin:    { "/dashboard": "/admin", "/staff": 200, "/admin": 200 },
  };
  for (const [role, paths] of Object.entries(matrix)) {
    const c = await cookieFor(users[role].email);
    for (const [path, want] of Object.entries(paths)) {
      const r = await get(path, c);
      const good = want === 200 ? r.status === 200 : r.status >= 300 && r.status < 400 && r.loc.endsWith(want);
      ok(good, `${role} ${path} -> ${want === 200 ? "200" : "redirect " + want} (dapat ${r.status} ${r.loc})`);
    }
  }
  // pelajar hanya nampak profil sendiri melalui API (RLS)
  const sc = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await sc.auth.signInWithPassword({ email: users.student.email, password: pw });
  const { data: rows } = await sc.from("profiles").select("id");
  ok(rows?.length === 1 && rows[0].id === users.student.id, "pelajar nampak profil sendiri sahaja");
  const { error: upErr } = await sc.from("profiles").update({ role: "admin" }).eq("id", users.student.id);
  const { data: after } = await admin.from("profiles").select("role").eq("id", users.student.id).single();
  ok(after.role === "student", `pelajar tak boleh naikkan peranan sendiri (${upErr ? "ditolak" : "tiada kesan"})`);
} finally {
  for (const u of Object.values(users)) if (u?.id) await admin.auth.admin.deleteUser(u.id);
}
console.log(fail ? `${fail} GAGAL` : "semua lulus");
process.exit(fail ? 1 : 0);
