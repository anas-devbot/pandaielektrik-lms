"use client";
import { useActionState } from "react";
import { mintaPautan } from "./actions";

export default function LupaForm() {
  const [state, action, pending] = useActionState(mintaPautan, undefined);
  if (state?.sent) {
    return (
      <p role="status" className="mt-4 rounded border p-3 text-sm">
        Jika emel itu berdaftar, pautan tetapan semula telah dihantar. Semak juga folder spam.
      </p>
    );
  }
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input name="email" type="email" placeholder="Emel" required autoComplete="email" className="rounded border p-2" />
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-black p-2 text-white disabled:opacity-50">{pending ? "Sedang hantar..." : "Hantar pautan"}</button>
    </form>
  );
}
