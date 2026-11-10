"use client";
import { useActionState, useRef, useState } from "react";
import { daftar } from "./actions";
import { PASSWORD_MIN, cadangKataLaluan } from "@/lib/password";

export default function DaftarForm({ points }: { points: string[] }) {
  const [state, action, pending] = useActionState(daftar, undefined);
  const pwRef = useRef<HTMLInputElement>(null);
  const [tunjuk, setTunjuk] = useState(false);
  const cadang = () => {
    if (pwRef.current) pwRef.current.value = cadangKataLaluan();
    setTunjuk(true); // supaya pelajar boleh baca dan simpan kata laluan cadangan
  };
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input name="full_name" defaultValue={state?.fullName} placeholder="Nama penuh" required autoComplete="name" className="rounded border p-2" />
      <input name="email" type="email" defaultValue={state?.email} placeholder="Emel" required autoComplete="email" className="rounded border p-2" />
      <input ref={pwRef} name="password" type={tunjuk ? "text" : "password"} placeholder={`Kata laluan (min ${PASSWORD_MIN})`} minLength={PASSWORD_MIN} required autoComplete="new-password" className="rounded border p-2" />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={cadang} className="rounded border px-3 py-1">Cadang kata laluan</button>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={tunjuk} onChange={(e) => setTunjuk(e.target.checked)} />
          Tunjuk kata laluan
        </label>
      </div>
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
