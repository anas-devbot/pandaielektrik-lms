"use client";
import { useActionState, useRef, useState } from "react";
import { kemaskiniKataLaluan } from "./actions";
import { PASSWORD_MIN, cadangKataLaluan } from "@/lib/password";
import { buttonClass } from "@/components/button";
import { Button } from "@/components/button";

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
      <input ref={pwRef} name="password" type={jenis} placeholder={`Kata laluan baharu (min ${PASSWORD_MIN})`} minLength={PASSWORD_MIN} required autoComplete="new-password" className="rounded-md border border-border bg-surface p-2" />
      <input ref={sahkanRef} name="password_sahkan" type={jenis} placeholder="Sahkan kata laluan baharu" minLength={PASSWORD_MIN} required autoComplete="new-password" className="rounded-md border border-border bg-surface p-2" />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button type="button" variant="secondary" onClick={cadang} className="w-auto">Cadang kata laluan</Button>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={tunjuk} onChange={(e) => setTunjuk(e.target.checked)} />
          Tunjuk kata laluan
        </label>
      </div>
      {state?.error && <p role="alert" className="text-sm text-error">{state.error}</p>}
      <button disabled={pending} className={buttonClass("primary")}>{pending ? "Sedang simpan..." : "Tetapkan kata laluan"}</button>
    </form>
  );
}
