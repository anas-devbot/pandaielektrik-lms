"use server";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { getCourse } from "@/lib/course";
import { TERMS_VERSION } from "@/content/terms";
import type { FormState } from "../daftar/actions";

export async function buatPesanan(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/log-masuk?next=%2Fbeli");
  if (form.get("terms") !== "on") return { error: "Anda mesti bersetuju dengan terma dan syarat sebelum bayar." };

  const course = await getCourse();
  if (!course) return { error: "Kursus belum tersedia." };
  const db = adminClient();
  const { data: enrolled } = await db.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", course.id).maybeSingle();
  if (enrolled) redirect("/dashboard");

  // Harga HANYA daripada courses.price (server). Medan lain dalam form diabaikan.
  // ASSUMPTION: format/panjang order_number belum disahkan dengan Bayarcash (ujian live).
  const orderNumber = `PE${randomBytes(7).toString("hex").toUpperCase()}`;
  const { data: order, error } = await db.from("orders").insert({
    user_id: user.id, course_id: course.id, order_number: orderNumber,
    amount: course.price, currency: course.currency,
    terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION,
  }).select("id").single();
  if (error || !order) return { error: "Tidak dapat mencipta pesanan. Cuba lagi." };
  redirect(`/pesanan/${order.id}`);
}
