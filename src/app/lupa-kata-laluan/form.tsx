"use client";
import { useActionState } from "react";
import { mintaPautan } from "./actions";
import { buttonClass } from "@/components/button";

export default function LupaForm() {
  const [state, action, pending] = useActionState(mintaPautan, undefined);
  if (state?.sent) {
    return (
      <p role="status" className="mt-4 rounded-md border border-border bg-surface p-3 text-sm">
        Jika emel itu berdaftar, pautan tetapan semula telah dihantar. Semak juga folder spam.
      </p>
    );
  }
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input name="email" type="email" placeholder="Emel" required autoComplete="email" className="rounded-md border border-border bg-surface p-2" />
      {state?.error && <p role="alert" className="text-sm text-error">{state.error}</p>}
      <button disabled={pending} className={buttonClass("primary")}>{pending ? "Sedang hantar..." : "Hantar pautan"}</button>
    </form>
  );
}
