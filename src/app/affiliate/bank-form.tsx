"use client";
import { useActionState } from "react";
import { simpanBank } from "./bank";
import { BANK_LIST } from "@/lib/affiliate-bank";
import { buttonClass } from "@/components/button";

export function BankForm({ current }: { current: boolean }) {
  const [s, a, p] = useActionState(simpanBank, undefined);
  return (
    <form action={a} className="mt-3 flex flex-col gap-3">
      <label className="text-sm font-semibold">Bank
        <select name="bank_name" required defaultValue="" className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-3 text-base font-normal">
          <option value="" disabled>Pilih bank</option>
          {BANK_LIST.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">Nama pemegang akaun (seperti dalam akaun bank)
        <input name="account_name" required minLength={3} maxLength={120} autoComplete="off"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-3 text-base font-normal" />
      </label>
      <label className="text-sm font-semibold">Nombor akaun
        <input name="account_no" required inputMode="numeric" autoComplete="off" placeholder="6 hingga 20 digit"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-3 text-base font-normal" />
        <span className="mt-1 block text-xs font-normal text-muted">Nombor penuh disimpan dienkrip. Selepas simpan, hanya 4 digit akhir dipaparkan.</span>
      </label>
      {s?.error && <p role="alert" className="text-sm text-error">{s.error}</p>}
      {s?.ok && <p role="status" className="text-sm text-success">{s.ok}</p>}
      <button disabled={p} className={buttonClass("primary")}>{p ? "Sedang simpan..." : current ? "Tukar butiran bank" : "Simpan butiran bank"}</button>
    </form>
  );
}
