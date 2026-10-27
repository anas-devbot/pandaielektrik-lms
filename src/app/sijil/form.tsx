"use client";
import { useActionState } from "react";
import { terbitSijil } from "./actions";

export default function SijilForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(terbitSijil, undefined);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <label className="text-sm">Nama pada sijil
        <input name="name" defaultValue={defaultName} required minLength={2} maxLength={120} className="mt-1 block w-full rounded border p-2" />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input name="confirm" type="checkbox" required className="mt-1" />
        <span>Saya mengesahkan ejaan nama ini betul. Nama tidak boleh diubah selepas sijil dikeluarkan.</span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-black p-2 text-white disabled:opacity-50">{pending ? "Sedang proses..." : "Keluarkan sijil"}</button>
    </form>
  );
}
