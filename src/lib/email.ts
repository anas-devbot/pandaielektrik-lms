import "server-only";

// Resend REST API melalui fetch (tiada SDK). Server sahaja: RESEND_API_KEY tidak boleh sampai ke klien.
export type Mail = { to: string; subject: string; text: string; html?: string; idempotencyKey?: string };

export async function sendMail(m: Mail): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: "email_not_configured" };
  const r = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(m.idempotencyKey ? { "Idempotency-Key": m.idempotencyKey } : {}) },
    body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}), ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}) }),
  });
  const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
  return r.ok && j.id ? { ok: true, id: j.id } : { ok: false, error: `resend_${r.status}${j.message ? `: ${j.message}` : ""}` };
}
