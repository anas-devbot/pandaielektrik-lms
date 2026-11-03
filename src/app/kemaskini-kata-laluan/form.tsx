"use client";
import { useActionState, useRef, useState } from "react";
import { kemaskiniKataLaluan } from "./actions";
import { PASSWORD_MIN, cadangKataLaluan } from "@/lib/password";

export default function KemaskiniForm() {
  const [state, action, pending] = useActionState(kemaskiniKataLaluan, undefined);
  const pwRef = useRef<HTMLInputElement>(null);
  const sahkanRef = useRef<HTMLInputElement>(null);
  const [tunjuk, setTunjuk] = useState(false);
  const cadang = () => {
    const pw = cadangKataLaluan();
    if (pwRef.current) pwRef.current.value = pw;
    if (sahkanRef.current) sahkanRef.current.value = pw;
    setTunjuk(true); // supaya pengguna boleh baca dan simpan kata laluan cadangan
  };
  const jenis = tunjuk ? "text" : "password";
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input ref={pwRef} name="password" type={jenis} placeholder={`Kata laluan baharu (min ${PASSWORD_MIN})`} minLength={PASSWORD_MIN} required autoComplete="new-password" className="rounded border p-2" />
      <input ref={sahkanRef} name="password_sahkan" type={jenis} placeholder="Sahkan kata laluan baharu" minLength={PASSWORD_MIN} required autoComplete="new-password" className="rounded border p-2" />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={cadang} className="rounded border px-3 py-1">Cadang kata laluan</button>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={tunjuk} onChange={(e) => setTunjuk(e.target.checked)} />
          Tunjuk kata laluan
        </label>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-black p-2 text-white disabled:opacity-50">{pending ? "Sedang simpan..." : "Tetapkan kata laluan"}</button>
    </form>
  );
}
