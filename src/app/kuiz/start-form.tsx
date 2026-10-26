"use client";
import { useActionState } from "react";
import { mula } from "./actions";

export default function StartForm({ type, chapter, label }: { type: "final" | "practice"; chapter?: string; label: string }) {
  const [state, action, pending] = useActionState(mula, undefined);
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="type" value={type} />
      {chapter && <input type="hidden" name="chapter" value={chapter} />}
      {state?.error && <p role="alert" className="mb-2 text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">{pending ? "Sila tunggu..." : label}</button>
    </form>
  );
}
