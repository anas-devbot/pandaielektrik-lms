import { timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";

// Cron harian affiliate (00:10 MYT) dengan `Authorization: Bearer $CRON_SECRET`. Tanpa rahsia dikonfigurasi, laluan ditutup.
// Langkah approve sahaja (B5). Tutup bulan / payout ditambah di B6 dalam laluan yang sama.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || secret.length < 16 || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return new Response(null, { status: 401 });
  try {
    const { data, error } = await adminClient().rpc("affiliate_approve_due");
    if (error) throw new Error(error.message);
    return Response.json({ ok: true, approved: data ?? 0 }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("cron affiliate gagal", e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
