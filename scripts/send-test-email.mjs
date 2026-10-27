// Hantar satu emel ujian melalui Resend. Guna: node --env-file=.env.local scripts/send-test-email.mjs alamat@contoh.com
const to = process.argv[2];
if (!to || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) { console.error("Guna: node --env-file=.env.local scripts/send-test-email.mjs <emel>  (perlu RESEND_API_KEY + EMAIL_FROM)"); process.exit(2); }
const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: "Ujian emel pandaielektrik.com", text: "Jika anda terima ini, Resend + DNS (SPF/DKIM) berfungsi." }) });
console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1);
