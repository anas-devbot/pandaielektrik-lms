import { timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";

// Cron harian affiliate (00:10 MYT) dengan `Authorization: Bearer $CRON_SECRET`. Tanpa rahsia dikonfigurasi, laluan ditutup.
// Susunan: approve dahulu (komisen yang cukup 7 hari), kemudian tutup period yang sudah berlalu (B6). Kedua-duanya idempotent.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || secret.length < 16 || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return new Response(null, { status: 401 });
  try {
    const db = adminClient();
    const approve = await db.rpc("affiliate_approve_due");
    if (approve.error) throw new Error(approve.error.message);
    const close = await db.rpc("affiliate_close_elapsed");
    if (close.error) throw new Error(close.error.message);
    return Response.json({ ok: true, approved: approve.data ?? 0, periods: close.data?.periods ?? [] }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("cron affiliate gagal", e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
