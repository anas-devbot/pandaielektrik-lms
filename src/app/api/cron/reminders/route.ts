import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/lib/notify";

// Dipanggil cron VPS setiap hari dengan `Authorization: Bearer $CRON_SECRET`. Tanpa rahsia dikonfigurasi, laluan ditutup.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || secret.length < 16 || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return new Response(null, { status: 401 });
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return Response.json({ ok: false, error: "email_not_configured" }, { status: 503 });
  try { return Response.json({ ok: true, ...(await runReminders()) }, { headers: { "cache-control": "no-store" } }); }
  catch (e) { console.error("cron reminders gagal", e instanceof Error ? e.message : e); return Response.json({ ok: false }, { status: 500 }); }
}
