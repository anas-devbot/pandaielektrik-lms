// Ujian landing (pelawat awam) terhadap app + Supabase LOCAL. Mula app: R2_BUCKET=pe-materials-test npx next dev -H 127.0.0.1 -p 3101
// Guna: node --experimental-strip-types --env-file=.env.local scripts/test-landing.mjs
import { createClient } from "@supabase/supabase-js";
import { LANDING } from "../src/content/landing.ts";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3101";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) { console.error("Hanya Supabase LOCAL"); process.exit(2); }
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fail = 0; const ok = (c, m) => { console.log(`${c ? "lulus" : "GAGAL"}: ${m}`); if (!c) fail++; };

const { data: course } = await db.from("courses").select("price").eq("slug", "kursus-elektrik").single();
const res = await fetch(BASE + "/");
const html = await res.text();
const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ").toLowerCase();

ok(res.status === 200, "GET / = 200");
ok(new RegExp(`rm ?${course.price / 100}\\b`).test(text), "harga dari DB dipaparkan");
ok(html.includes('href="/terma"'), "pautan terma dan syarat wujud");
ok(text.includes("apa kursus ini bukan") && text.includes("lesen") && text.includes("kompetensi"), "kotak 'apa kursus ini bukan' (lesen, kompetensi)");
for (const s of LANDING.journey) ok(text.includes(s.title.toLowerCase()), `laluan langkah ${s.n}: ${s.title}`);
for (const w of ["gaji", "pendapatan", "layak", "jaminan kerja", "slot terhad", "temu duga", "google form"]) ok(!text.includes(w), `tiada teks terlarang: ${w}`);
ok(!text.includes("draf: menunggu ahz") && !text.includes("[menunggu"), "awam tidak nampak penanda tempat DRAF");
for (const h of ["pengajar", "soalan lazim", "contoh sijil", "bayaran balik"]) ok(!text.includes(h), `bahagian DRAF disembunyikan: ${h}`);
ok(!html.includes('href="/beli"'), "jualan ditutup: tiada pautan /beli untuk awam");
ok(text.includes("pendaftaran belum dibuka"), "mesej pendaftaran belum dibuka");
ok(!/<img[^>]+src="[^"]*r2\./i.test(html), "tiada URL R2 didedahkan");
console.log(fail ? `${fail} GAGAL` : "semua lulus");
process.exit(fail ? 1 : 0);
