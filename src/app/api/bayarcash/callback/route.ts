import { verifyPreTransactionCallbackData, verifyTransactionCallbackData } from "bayarcash";
import { adminClient } from "@/lib/supabase/admin";
import { bayarcashEnv, toSen } from "@/lib/bayarcash";
import { sendReceipt } from "@/lib/notify";

// SATU-SATUNYA sumber kebenaran bayaran (CLAUDE.md #2): callback server-ke-server.
// Balas 200 hanya bila diproses/diabaikan dengan sah; 403 checksum salah; 500 ralat sementara (Bayarcash cuba semula, 5x/5min).
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let secret: string;
  try { secret = bayarcashEnv().secret; } catch { return new Response(null, { status: 500 }); }

  const raw = await req.text();
  if (raw.length > 20_000) return new Response(null, { status: 413 });
  let body: Record<string, unknown>;
  try {
    // Bayarcash hantar form (disahkan live: urlencoded, GuzzleHttp); JSON diterima juga.
    body = (req.headers.get("content-type") ?? "").includes("json")
      ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
  } catch { return new Response(null, { status: 400 }); }

  // Senarai medan checksum berbeza ikut record_type: semak ikut jenis.
  if (body.record_type === "pre_transaction")
    return new Response(null, { status: verifyPreTransactionCallbackData(body, secret) ? 200 : 403 });
  if (body.record_type !== "transaction") return new Response(null, { status: 200 });
  if (!verifyTransactionCallbackData(body, secret)) return new Response(null, { status: 403 });

  const { data: outcome, error } = await adminClient().rpc("apply_payment_event", {
    p_transaction_id: String(body.transaction_id ?? ""),
    p_status: Number(body.status),
    p_order_number: String(body.order_number ?? ""),
    p_amount: toSen(body.amount),
    p_currency: String(body.currency ?? ""),
    p_raw: body,
  });
  if (error) { console.error("apply_payment_event gagal", error.message); return new Response(null, { status: 500 }); }
  if (outcome === "paid") await sendReceipt(String(body.order_number));   // kegagalan emel tidak menjejas balasan 200
  return new Response(null, { status: 200 });
}
