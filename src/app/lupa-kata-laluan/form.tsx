"use client";
import { useActionState } from "react";
import { mintaPautan } from "./actions";
import { Button } from "@/components/button";
import { Field, FormError } from "@/components/auth";

export default function LupaForm() {
  const [state, action, pending] = useActionState(mintaPautan, undefined);
  if (state?.sent) {
    return (
      <p role="status" className="rounded-md border border-border bg-paper p-3 text-sm">
        Jika emel itu berdaftar, pautan tetapan semula telah dihantar. Semak juga folder spam.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field id="email" label="Emel" name="email" type="email" required autoComplete="email" />
      {state?.error && <FormError>{state.error}</FormError>}
      <Button type="submit" loading={pending}>{pending ? "Sedang hantar..." : "Hantar pautan"}</Button>
    </form>
  );
}
