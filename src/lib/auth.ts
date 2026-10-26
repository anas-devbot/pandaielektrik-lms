import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "student" | "reviewer" | "approver" | "admin";
const RANK: Record<Role, number> = { student: 0, reviewer: 1, approver: 2, admin: 3 };

export function homeFor(role: Role) {
  return role === "admin" ? "/admin" : role === "student" ? "/dashboard" : "/staff";
}

/** Pengguna semasa + profil (peranan dibaca daripada DB melalui RLS, bukan daripada token/metadata klien). */
export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
  return data ? { id: user.id, email: user.email ?? "", fullName: data.full_name as string, role: data.role as Role } : null;
}

/** Tapis ketat: peranan tepat. Student ke /dashboard, staf ke /staff (reviewer+approver), admin ke /admin. */
export async function requireRole(allowed: Role[]) {
  const p = await getProfile();
  if (!p) redirect("/log-masuk");
  if (!allowed.includes(p.role)) redirect(homeFor(p.role));
  return p;
}

export { RANK };

/** `next` hanya path dalaman (elak open redirect). */
export function safeNext(next: unknown): string | null {
  return typeof next === "string" && /^\/(?!\/|\\)/.test(next) ? next : null;
}
