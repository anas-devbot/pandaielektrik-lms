"use client";
import { useActionState } from "react";
import { tandaiBayar, tukarStatus } from "./ops";

const Msg = ({ s }: { s?: { error?: string; ok?: string } }) => (<>
  {s?.error && <p role="alert" className="text-sm text-error">{s.error}</p>}
  {s?.ok && <p role="status" className="text-sm text-success">{s.ok}</p>}
</>);

// Butang ikut status semasa. Nota diperlukan untuk tolak dan gantung (disahkan di server).
export function StatusForm({ affiliate, status }: { affiliate: string; status: string }) {
  const [s, a, p] = useActionState(tukarStatus, undefined);
  const btn = "min-h-10 rounded-md border px-3 text-sm font-semibold";
  return (
    <form action={a} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="affiliate" value={affiliate} />
      <input name="note" placeholder="Nota (wajib untuk tolak atau gantung)" maxLength={300}
        className="rounded-md border border-border bg-paper px-3 py-2 text-base" />
      <div className="flex flex-wrap gap-2">
        {(status === "pending" || status === "suspended") && (
          <button name="to" value="approved" disabled={p} className={`${btn} border-ink bg-ink text-paper`}>Luluskan</button>
        )}
        {status === "pending" && (
          <button name="to" value="rejected" disabled={p} className={`${btn} border-error text-error`}>Tolak</button>
        )}
        {status === "approved" && (
          <button name="to" value="suspended" disabled={p} className={`${btn} border-error text-error`}>Gantung</button>
        )}
      </div>
      <Msg s={s} />
    </form>
  );
}

export function PayForm({ payout }: { payout: string }) {
  const [s, a, p] = useActionState(tandaiBayar, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="payout" value={payout} />
      <input name="ref" required maxLength={60} placeholder="Rujukan transfer bank"
        className="rounded-md border border-border bg-paper px-3 py-2 text-base" />
      <button disabled={p} className="min-h-10 rounded-md border border-ink bg-ink px-3 text-sm font-semibold text-paper">
        {p ? "Sedang simpan..." : "Tandakan sudah dibayar"}
      </button>
      <Msg s={s} />
    </form>
  );
}
