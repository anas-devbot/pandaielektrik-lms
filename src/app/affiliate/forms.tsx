"use client";
import { useActionState } from "react";
import { mohonAffiliate } from "./actions";
import { buttonClass } from "@/components/button";

export function MohonAffiliateForm() {
  const [s, a, p] = useActionState(mohonAffiliate, undefined);
  return (
    <form action={a} className="mt-3 flex flex-col gap-3">
      <label className="text-sm font-semibold">Kod rujukan pilihan anda
        <input name="code" required minLength={4} maxLength={20} pattern="[A-Za-z0-9]{4,20}" placeholder="cth. ELEKTRIK10"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-3 text-base" />
        <span className="mt-1 block text-xs font-normal text-muted">4 hingga 20 huruf atau nombor. Kod tidak boleh ditukar selepas diluluskan.</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input name="terms" type="checkbox" required className="mt-1" />
        <span>Saya setuju dengan draf terma affiliate di atas dan faham komisen tertakluk kepada semakan AHZ.</span>
      </label>
      {s?.error && <p role="alert" className="text-sm text-error">{s.error}</p>}
      {s?.ok && <p role="status" className="text-sm text-success">{s.ok}</p>}
      <button disabled={p} className={buttonClass("primary")}>{p ? "Sedang hantar..." : "Mohon jadi affiliate"}</button>
    </form>
  );
}
