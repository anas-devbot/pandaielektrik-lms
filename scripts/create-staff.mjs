// Cipta akaun staf (reviewer | approver | admin). Hanya admin boleh jalankan (perlukan service-role dalam env).
// Guna: node --env-file=.env.local scripts/create-staff.mjs <emel> <peranan> "<Nama>"
// Kata laluan sementara dicetak SEKALI ke terminal; staf patut tukar selepas log masuk pertama.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const [emailRaw, role, name] = process.argv.slice(2);
if (!emailRaw || !["reviewer", "approver", "admin"].includes(role) || !name) {
  console.error('Guna: create-staff.mjs <emel> <reviewer|approver|admin> "<Nama>"'); process.exit(2);
}
const email = emailRaw.trim().toLowerCase();
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const inv = await db.from("staff_invites").upsert({ email, role });
if (inv.error) throw inv.error;
const password = randomBytes(12).toString("base64url");
const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
if (error) { await db.from("staff_invites").delete().eq("email", email); throw error; }
console.log(`dicipta: ${data.user.email} (${role})\nkata laluan sementara: ${password}`);
