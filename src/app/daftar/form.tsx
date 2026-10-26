"use client";
import { useActionState } from "react";
import { daftar } from "./actions";

export default function DaftarForm({ points }: { points: string[] }) {
  const [state, action, pending] = useActionState(daftar, undefined);
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input name="full_name" defaultValue={state?.fullName} placeholder="Nama penuh" required autoComplete="name" className="rounded border p-2" />
      <input name="email" type="email" defaultValue={state?.email} placeholder="Emel" required autoComplete="email" className="rounded border p-2" />
      <input name="password" type="password" placeholder="Kata laluan (min 8)" minLength={8} required autoComplete="new-password" className="rounded border p-2" />
      <section className="rounded border bg-zinc-50 p-3 text-sm text-black">
        <h2 className="font-medium">Notis privasi</h2>
        <ul className="mt-1 list-disc pl-5">{points.map((p) => <li key={p}>{p}</li>)}</ul>
      </section>
      <label className="flex items-start gap-2 text-sm">
        <input name="privacy" type="checkbox" required className="mt-1" />
        <span>Saya telah membaca dan bersetuju dengan notis privasi di atas.</span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-black p-2 text-white disabled:opacity-50">{pending ? "Sedang daftar..." : "Daftar"}</button>
    </form>
  );
}
