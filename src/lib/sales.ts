// Pintu jualan sebelum launch awam. Tutup secara default: buka dengan SALES_OPEN=1 dalam env server (restart servis).
// SALES_ALLOW_EMAILS (dipisah koma) = penguji yang boleh beli walaupun ditutup (cth. ujian RM2 Pintu 1).
// ponytail: env, bukan config DB, kerana ia pintu sementara; buang fail ini bila launch awam.
export function salesOpen(email?: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SALES_OPEN === "1") return true;
  const allow = (env.SALES_ALLOW_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return !!email && allow.includes(email.toLowerCase());
}
