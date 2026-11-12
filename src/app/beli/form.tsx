"use client";
import Link from "next/link";
import { useActionState } from "react";
import { buatPesanan } from "./actions";

export default function BeliForm({ sla }: { sla?: number }) {
  const [state, action, pending] = useActionState(buatPesanan, undefined);
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      {/* SLA pilihan A (disahkan Bos, 12 Nov 2026; DRAF-teks-AHZ seksyen 7). Dipaparkan sebelum bayar. */}
      {sla && <p className="text-sm">Semakan subjektif, skematik dan praktikal dilakukan dalam tempoh {sla} hari bekerja.</p>}
      <label className="flex items-start gap-2 text-sm">
        <input name="terms" type="checkbox" required className="mt-1" />
        <span>Saya bersetuju dengan <Link className="underline" href="/terma" target="_blank">terma dan syarat</Link>, termasuk polisi refund.</span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-black p-2 text-white disabled:opacity-50">{pending ? "Sedang proses..." : "Teruskan ke pembayaran"}</button>
    </form>
  );
}
