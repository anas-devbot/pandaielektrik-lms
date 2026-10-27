"use client";
import { useActionState } from "react";
import { tindakanRefund } from "./actions";

export default function TindakanForm({ request, ops }: { request: string; ops: { op: string; label: string; danger?: boolean }[] }) {
  const [s, a, p] = useActionState(tindakanRefund, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="request" value={request} />
      <textarea name="note" rows={2} placeholder="Nota (wajib untuk override, tolak, dan rujukan transfer bank: tarikh, bank, no. rujukan)" className="rounded border p-2 text-sm" />
      {s?.error && <p role="alert" className="text-sm text-red-600">{s.error}</p>}
      {s?.ok && <p role="status" className="text-sm text-green-700">{s.ok}</p>}
      <div className="flex gap-2">{ops.map((o) => <button key={o.op} name="op" value={o.op} disabled={p} className={`rounded px-3 py-1 text-white ${o.danger ? "bg-red-700" : "bg-black"} disabled:opacity-50`}>{o.label}</button>)}</div>
    </form>
  );
}
