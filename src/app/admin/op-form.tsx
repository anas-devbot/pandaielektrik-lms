"use client";
import { useActionState, useState } from "react";
import { jalankan } from "./ops";

export type Field = { name: string; label: string; type?: "text" | "number" | "textarea" | "select" | "datetime-local" | "email"; options?: { v: string; l: string }[]; required?: boolean; defaultValue?: string | number; placeholder?: string };
const cls = "rounded border p-2 text-sm";

/** Borang tindakan admin generik: menghantar `op` + medan kepada satu server action. Sebab (reason) wajib bila diminta. */
export function OpForm({ op, hidden, fields, submit, danger }: { op: string; hidden?: Record<string, string>; fields: Field[]; submit: string; danger?: boolean }) {
  const [s, a, p] = useActionState(jalankan, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="op" value={op} />
      {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => f.type === "textarea" ? <textarea key={f.name} name={f.name} rows={3} required={f.required} defaultValue={f.defaultValue} placeholder={f.placeholder ?? f.label} className={cls} aria-label={f.label} />
        : f.type === "select" ? <label key={f.name} className="text-sm">{f.label}<select name={f.name} defaultValue={f.defaultValue} className={`${cls} ml-2`}>{f.options?.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>
        : <input key={f.name} name={f.name} type={f.type ?? "text"} required={f.required} defaultValue={f.defaultValue} placeholder={f.placeholder ?? f.label} aria-label={f.label} className={cls} />)}
      {s?.error && <p role="alert" className="text-sm text-red-600">{s.error}</p>}
      {s?.ok && <p role="status" className="text-sm text-green-700">{s.ok}</p>}
      <button disabled={p} className={`rounded px-3 py-1.5 text-white disabled:opacity-50 ${danger ? "bg-red-700" : "bg-black"}`}>{submit}</button>
    </form>
  );
}

export function CopyMsg({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="text-xs underline" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }, () => {}); }}>{done ? "Disalin" : "Salin mesej"}</button>;
}
