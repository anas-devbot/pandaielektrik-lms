import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/email";

// Teks emel ialah DRAF (ASSUMPTION: belum disemak Saiful/AHZ). Tiada janji, tiada arahan kerja pendawaian (CLAUDE.md #10).
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
const fmtDate = (iso: string) => new Intl.DateTimeFormat("ms-MY", { dateStyle: "long", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso));
const sign = "\n\nPandaiElektrik (AHZ Teknik)";

/** Resit selepas callback `paid`. Idempotent: jadual reminders (type 'receipt') + Idempotency-Key. Tidak membaling ralat: kegagalan emel tak boleh menggagalkan callback. */
export async function sendReceipt(orderNumber: string): Promise<void> {
  try {
    const db = adminClient();
    const { data: o } = await db.from("orders").select("order_number, amount, currency, user_id, course_id, enrollments(id, access_ends_at), courses(title)").eq("order_number", orderNumber).eq("status", "paid").maybeSingle();
    const enr = (o?.enrollments as unknown as { id: string; access_ends_at: string }[] | null)?.[0];
    if (!o || !enr) return;
    const { data: sent } = await db.from("reminders").select("id").eq("enrollment_id", enr.id).eq("type", "receipt").maybeSingle();
    if (sent) return;
    const { data: u } = await db.auth.admin.getUserById(o.user_id); const to = u.user?.email; if (!to) return;
    const title = (o.courses as unknown as { title: string } | null)?.title ?? "Kursus";
    const r = await sendMail({ to, idempotencyKey: `receipt-${enr.id}`, subject: `Resit bayaran ${o.order_number}`,
      text: `Terima kasih. Bayaran anda telah diterima.\n\nKursus: ${title}\nNo. order: ${o.order_number}\nJumlah: ${o.currency} ${(o.amount / 100).toFixed(2)}\nAkses sehingga: ${fmtDate(enr.access_ends_at)}\n\nMula belajar: ${site()}/dashboard${sign}` });
    if (r.ok) await db.from("reminders").insert({ enrollment_id: enr.id, type: "receipt" });
    else console.error("resit gagal", r.error);
  } catch (e) { console.error("resit gagal", e instanceof Error ? e.message : e); }
}

type Stuck = { enrollment_id: string; full_name: string; email: string; reason: string; detail: { days?: number; days_left?: number } };
const TEXT: Record<string, (s: Stuck) => { subject: string; body: string }> = {
  akses_30: (s) => ({ subject: "Akses kursus anda hampir tamat", body: `Salam ${s.full_name},\n\nAkses kursus anda tinggal lebih kurang ${s.detail.days_left} hari. Selepas itu video dan bahan PDF ditutup (sijil dan rekod kekal).\n\nTeruskan di ${site()}/dashboard` }),
  akses_7: (s) => ({ subject: "Akses kursus tinggal kurang seminggu", body: `Salam ${s.full_name},\n\nAkses kursus anda tinggal lebih kurang ${s.detail.days_left} hari. Hubungi kami jika anda memerlukan bantuan.\n\n${site()}/dashboard` }),
  tiada_aktiviti: (s) => ({ subject: "Kami nampak anda belum sambung belajar", body: `Salam ${s.full_name},\n\nKami perasan tiada aktiviti pada akaun anda sejak ${s.detail.days} hari lalu. Anda boleh sambung bila-bila masa sebelum akses tamat.\n\n${site()}/dashboard` }),
};

/** Peringatan harian (dipanggil cron). Satu emel setiap (enrollment, jenis); dikunci oleh unique pada reminders. */
export async function runReminders(): Promise<{ sent: number; skipped: number; failed: number }> {
  const db = adminClient(); const out = { sent: 0, skipped: 0, failed: 0 };
  const { data: rows, error } = await db.rpc("stuck_students"); if (error) throw error;
  const todo = ((rows ?? []) as Stuck[]).filter((s) => TEXT[s.reason]);
  const { data: done } = await db.from("reminders").select("enrollment_id, type").in("enrollment_id", [...new Set(todo.map((s) => s.enrollment_id))]);
  const had = new Set((done ?? []).map((d) => `${d.enrollment_id}:${d.type}`));
  for (const s of todo) {
    if (had.has(`${s.enrollment_id}:${s.reason}`)) { out.skipped++; continue; }
    const { subject, body } = TEXT[s.reason](s);
    const r = await sendMail({ to: s.email, subject, text: body + sign, idempotencyKey: `rem-${s.enrollment_id}-${s.reason}` });
    if (r.ok) { await db.from("reminders").insert({ enrollment_id: s.enrollment_id, type: s.reason }); out.sent++; } else { console.error("peringatan gagal", r.error); out.failed++; }
  }
  return out;
}
