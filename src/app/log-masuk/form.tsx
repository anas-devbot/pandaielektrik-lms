"use client";
import { useActionState } from "react";
import { logMasuk } from "./actions";

export default function LogMasukForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(logMasuk, undefined);
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input name="email" type="email" defaultValue={state?.email} placeholder="Emel" required autoComplete="email" className="rounded border p-2" />
      <input name="password" type="password" placeholder="Kata laluan" required autoComplete="current-password" className="rounded border p-2" />
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-black p-2 text-white disabled:opacity-50">{pending ? "Sedang log masuk..." : "Log masuk"}</button>
    </form>
  );
}
