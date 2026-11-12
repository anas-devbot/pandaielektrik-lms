"use client";
import { useActionState } from "react";
import { logMasuk } from "./actions";
import { Button } from "@/components/button";
import { Field, FormError } from "@/components/auth";

export default function LogMasukForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(logMasuk, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <Field id="email" label="Emel" name="email" type="email" defaultValue={state?.email} required autoComplete="email" />
      <Field id="password" label="Kata laluan" name="password" type="password" required autoComplete="current-password" />
      {state?.error && <FormError>{state.error}</FormError>}
      <Button type="submit" loading={pending} className="mt-1">Log masuk</Button>
    </form>
  );
}
