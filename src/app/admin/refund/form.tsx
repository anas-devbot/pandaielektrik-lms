"use client";
import { useActionState } from "react";
import { tindakanRefund } from "./actions";
import { Button } from "@/components/button";

export default function TindakanForm({ request, ops }: { request: string; ops: { op: string; label: string; danger?: boolean }[] }) {
  const [s, a, p] = useActionState(tindakanRefund, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="request" value={request} />
      <textarea name="note" rows={2} placeholder="Nota (wajib untuk override, tolak, dan rujukan transfer bank: tarikh, bank, no. rujukan)" className="rounded-md border border-border bg-surface p-2 text-sm" />
      {s?.error && <p role="alert" className="text-sm text-error">{s.error}</p>}
      {s?.ok && <p role="status" className="text-sm text-success">{s.ok}</p>}
      <div className="flex gap-2">{ops.map((o) => <Button key={o.op} name="op" value={o.op} disabled={p} variant={o.danger ? "danger" : "primary"} className="w-auto">{o.label}</Button>)}</div>
    </form>
  );
}
