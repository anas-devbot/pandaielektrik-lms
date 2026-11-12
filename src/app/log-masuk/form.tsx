"use client";
import { useActionState } from "react";
import { logMasuk } from "./actions";
import { Button } from "@/components/button";

export default function LogMasukForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(logMasuk, undefined);
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input name="email" type="email" defaultValue={state?.email} placeholder="Emel" required autoComplete="email" className="rounded-md border border-border bg-surface p-3" />
      <input name="password" type="password" placeholder="Kata laluan" required autoComplete="current-password" className="rounded-md border border-border bg-surface p-3" />
      {state?.error && <p role="alert" className="text-sm text-error">{state.error}</p>}
      <Button type="submit" loading={pending}>Log masuk</Button>
    </form>
  );
}
