// Import soalan dari CSV. Lajur: bab, soalan, A, B, C, D, jawapan, penjelasan (pilihan), jenis (pilihan: final|practice).
// `bab` = nombor bab (position) atau tajuk tepat. Idempotent: soalan sama (bab+jenis+teks) dilangkau.
// Guna: node --env-file=.env.local scripts/import-questions.mjs <fail.csv> [--dry-run] [--type final|practice] [--course <slug>]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--type" && args[args.indexOf(a) - 1] !== "--course");
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const dry = args.includes("--dry-run"), defType = flag("--type") ?? "final", courseSlug = flag("--course");
if (!file || !["final", "practice"].includes(defType)) { console.error("Guna: import-questions.mjs <fail.csv> [--dry-run] [--type final|practice] [--course slug]"); process.exit(2); }

function parseCsv(text) {  // RFC4180 ringkas: medan bertanda petik, "" = petik, baris baharu dalam petik
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const rows = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
const head = rows.shift().map((h) => h.trim().toLowerCase());
const col = (n) => head.indexOf(n);
for (const n of ["bab", "soalan", "a", "b", "c", "d", "jawapan"]) if (col(n) < 0) { console.error(`Lajur "${n}" tiada dalam CSV`); process.exit(2); }

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: course } = await (courseSlug ? db.from("courses").select("id").eq("slug", courseSlug) : db.from("courses").select("id").order("created_at").limit(1)).maybeSingle();
if (!course) { console.error("Kursus tidak dijumpai"); process.exit(2); }
const { data: chapters } = await db.from("chapters").select("id, position, title").eq("course_id", course.id);

const errors = [], plan = [];
rows.forEach((r, i) => {
  const line = i + 2, v = (n) => (r[col(n)] ?? "").trim();
  const chap = chapters.find((c) => String(c.position) === v("bab") || c.title === v("bab"));
  const ans = v("jawapan").toUpperCase(), type = v("jenis") || defType;
  if (!chap) errors.push(`baris ${line}: bab "${v("bab")}" tiada`);
  if (!v("soalan")) errors.push(`baris ${line}: soalan kosong`);
  for (const l of ["a", "b", "c", "d"]) if (!v(l)) errors.push(`baris ${line}: pilihan ${l.toUpperCase()} kosong`);
  if (!["A", "B", "C", "D"].includes(ans)) errors.push(`baris ${line}: jawapan mesti A-D (dapat "${v("jawapan")}")`);
  if (!["final", "practice"].includes(type)) errors.push(`baris ${line}: jenis mesti final atau practice`);
  if (new Set(["a", "b", "c", "d"].map((l) => v(l).toLowerCase())).size < 4) errors.push(`baris ${line}: pilihan bertindih`);
  plan.push({ line, chap, type, body: v("soalan"), options: ["A", "B", "C", "D"].map((l) => ({ label: l, body: v(l.toLowerCase()), is_correct: l === ans })), explanation: v("penjelasan") || null });
});
const seen = new Set();
for (const p of plan) { const k = `${p.chap?.id}|${p.type}|${p.body}`; if (seen.has(k)) errors.push(`baris ${p.line}: soalan berganda dalam CSV`); seen.add(k); }
if (errors.length) { console.error(errors.join("\n")); console.error(`\n${errors.length} ralat: tiada apa dimasukkan.`); process.exit(1); }

let added = 0, skipped = 0;
for (const p of plan) {
  const { data: ex } = await db.from("quiz_questions").select("id").eq("course_id", course.id).eq("chapter_id", p.chap.id).eq("type", p.type).eq("body", p.body).maybeSingle();
  if (ex) { skipped++; continue; }
  if (dry) { added++; continue; }
  const { data: q, error } = await db.from("quiz_questions").insert({ course_id: course.id, chapter_id: p.chap.id, type: p.type, body: p.body, explanation: p.explanation }).select("id").single();
  if (error) { console.error(`baris ${p.line}:`, error.message); process.exit(1); }
  const { error: oe } = await db.from("quiz_options").insert(p.options.map((o) => ({ ...o, question_id: q.id })));
  if (oe) { await db.from("quiz_questions").delete().eq("id", q.id); console.error(`baris ${p.line}:`, oe.message); process.exit(1); }
  added++;
}
console.log(`${dry ? "[dry-run] " : ""}${added} soalan ${dry ? "akan ditambah" : "ditambah"}, ${skipped} dilangkau (sudah ada).`);
