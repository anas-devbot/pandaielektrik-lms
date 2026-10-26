import { createClient } from "@/lib/supabase/server";

export const rm = (sen: number) =>
  new Intl.NumberFormat("ms-MY", { style: "currency", currency: "MYR", minimumFractionDigits: sen % 100 ? 2 : 0 }).format(sen / 100);

// UI satu kursus (skema sedia multi-course). Harga SENTIASA dibaca daripada DB di server.
export async function getCourse() {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("id, slug, title, price, currency, config").order("created_at").limit(1).maybeSingle();
  return data;
}
