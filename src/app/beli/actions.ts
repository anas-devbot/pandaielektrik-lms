"use server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { getCourse } from "@/lib/course";
import { salesOpen } from "@/lib/sales";
import { createPaymentIntent } from "@/lib/bayarcash";
import { REF_COOKIE, decodeRefCookie, isSelfReferral, withinWindow } from "@/lib/affiliate";
import { TERMS_VERSION } from "@/content/terms";
import type { FormState } from "../daftar/actions";

// Atribusi affiliate (B2). Gagal di mana-mana langkah = tiada kod, pembayaran tetap jalan.
// Komisen hanya dicipta oleh callback (B3); di sini cuma kod disimpan pada order.
async function resolveReferral(db: ReturnType<typeof adminClient>, course: { config: unknown }, buyer: { id: string; email: string }) {
  try {
    const jar = await cookies();
    const c = decodeRefCookie(jar.get(REF_COOKIE)?.value);
    const days = Number((course.config as Record<string, unknown>)?.affiliate_cookie_days);
    if (!c || !Number.isFinite(days) || !withinWindow(c.setAt, Math.floor(Date.now() / 1000), days)) return null;
    const { data: aff } = await db.from("affiliates").select("user_id, code, status").ilike("code", c.code).maybeSingle();
    if (!aff || aff.status !== "approved") return null;
    const { data: au } = await db.auth.admin.getUserById(aff.user_id);
    if (!au?.user?.email) return null;
    if (isSelfReferral({ userId: buyer.id, email: buyer.email }, { userId: aff.user_id, email: au.user.email })) return null;
    return aff.code;
  } catch (e) {
    console.error("atribusi affiliate diabaikan", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function buatPesanan(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/log-masuk?next=%2Fbeli");
  if (!salesOpen(user.email)) return { error: "Pendaftaran belum dibuka." };
  if (form.get("terms") !== "on") return { error: "Anda mesti bersetuju dengan terma dan syarat sebelum bayar." };

  const course = await getCourse();
  if (!course) return { error: "Kursus belum tersedia." };
  const db = adminClient();
  const { data: enrolled } = await db.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", course.id).maybeSingle();
  if (enrolled) redirect("/dashboard");

  // Harga HANYA daripada courses.price (server). Medan lain dalam form diabaikan.
  // ASSUMPTION: format/panjang order_number belum disahkan dengan Bayarcash (ujian live).
  const orderNumber = `PE${randomBytes(7).toString("hex").toUpperCase()}`;
  const referral = await resolveReferral(db, course, { id: user.id, email: user.email ?? "" });
  const { data: order, error } = await db.from("orders").insert({
    user_id: user.id, course_id: course.id, order_number: orderNumber,
    amount: course.price, currency: course.currency,
    terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION,
    referral_code: referral,
  }).select("id").single();
  if (error || !order) return { error: "Tidak dapat mencipta pesanan. Cuba lagi." };

  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  let intent: { id: string; url: string };
  try {
    const { data: prof } = await db.from("profiles").select("full_name").eq("id", user.id).single();
    intent = await createPaymentIntent({
      orderNumber, amountSen: course.price, payerName: prof?.full_name ?? user.email!, payerEmail: user.email!,
      callbackUrl: `${site}/api/bayarcash/callback`, returnUrl: `${site}/pesanan/${order.id}`,
    });
  } catch (e) {
    console.error("createPaymentIntent gagal", e instanceof Error ? e.message : e);
    await db.from("orders").delete().eq("id", order.id).eq("status", "pending"); // tiada pautan bayaran = jangan tinggal order yatim
    return { error: "Pembayaran tidak dapat dimulakan sekarang. Cuba lagi sebentar." };
  }
  await db.from("orders").update({ payment_intent_id: intent.id, payment_url: intent.url }).eq("id", order.id);
  redirect(intent.url);
}
