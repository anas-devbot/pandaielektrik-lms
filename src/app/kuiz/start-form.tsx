"use client";
import { useActionState } from "react";
import { mula } from "./actions";
import { buttonClass } from "@/components/button";

export default function StartForm({ label }: { label: string }) {
  const [state, action, pending] = useActionState(mula, undefined);
  return (
    <form action={action} className="mt-4">
      {state?.error && <p role="alert" className="mb-2 text-sm text-error">{state.error}</p>}
      <button disabled={pending} className={buttonClass("primary")}>{pending ? "Sila tunggu..." : label}</button>
    </form>
  );
}
