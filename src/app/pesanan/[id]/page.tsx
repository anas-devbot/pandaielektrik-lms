import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rm } from "@/lib/course";

export const dynamic = "force-dynamic";

// Return URL Bayarcash TIDAK menentukan bayaran (CLAUDE.md #2): halaman ini hanya papar status order daripada DB.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: o } = await supabase.from("orders").select("order_number, amount, status, paid_at").eq("id", id).maybeSingle(); // RLS: pesanan sendiri
  if (!o) notFound();
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">Pesanan {o.order_number}</h1>
      <p className="mt-2">Jumlah: {rm(o.amount)}</p>
      {o.status === "paid" ? (
        <p className="mt-2">Bayaran diterima. <Link className="underline" href="/dashboard">Ke dashboard</Link></p>
      ) : o.status === "refunded" ? (
        <p className="mt-2">Pesanan ini telah dipulangkan.</p>
      ) : (
        <p className="mt-2">Pembayaran sedang disemak. Muat semula halaman ini sebentar lagi. (Pautan bayaran Bayarcash belum dihidupkan.)</p>
      )}
    </main>
  );
}
