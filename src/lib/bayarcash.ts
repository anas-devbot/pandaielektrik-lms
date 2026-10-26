import "server-only";
import { Bayarcash } from "bayarcash";

// SDK rasmi bayarcash@1.0.1, API v3, produksi (tiada useSandbox). Jangan tulis semula checksum sendiri (CLAUDE.md #13).
export function bayarcashEnv() {
  const e = process.env;
  const pat = e.BAYARCASH_PAT, secret = e.BAYARCASH_SECRET_KEY, portal = e.BAYARCASH_PORTAL_KEY;
  if (!pat || !secret || !portal) throw new Error("BAYARCASH_PAT / BAYARCASH_SECRET_KEY / BAYARCASH_PORTAL_KEY tiada dalam env");
  return { pat, secret, portal };
}

/** "149.00" -> 14900. null jika format pelik (jangan teka). Disahkan live: Bayarcash hantar "2.00". */
export function toSen(amount: unknown): number | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount).trim());
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || 0) : null;
}

export const fromSen = (sen: number) => (sen / 100).toFixed(2); // 14900 -> "149.00"

export async function createPaymentIntent(o: {
  orderNumber: string; amountSen: number; payerName: string; payerEmail: string; callbackUrl: string; returnUrl: string;
}) {
  const { pat, secret, portal } = bayarcashEnv();
  const bc = new Bayarcash(pat, { apiVersion: "v3" });
  const data: Record<string, string | number> = {
    portal_key: portal, payment_channel: Bayarcash.FPX, order_number: o.orderNumber,
    amount: fromSen(o.amountSen), payer_name: o.payerName, payer_email: o.payerEmail,
    callback_url: o.callbackUrl, return_url: o.returnUrl,
  };
  data.checksum = bc.createPaymentIntentChecksumValue(secret, data);
  const pi = await bc.createPaymentIntent(data);
  return { id: pi.id as string, url: pi.url as string };
}
