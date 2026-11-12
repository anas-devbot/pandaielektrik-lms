"use client";
import { useActionState, useRef, useState } from "react";
import { kemaskiniKataLaluan } from "./actions";
import { PASSWORD_MIN, cadangKataLaluan } from "@/lib/password";
import { Button } from "@/components/button";
import { Field, FormError } from "@/components/auth";

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
    <form action={action} className="flex flex-col gap-3">
      <Field id="password" label={`Kata laluan baharu (min ${PASSWORD_MIN})`} name="password" type={jenis} minLength={PASSWORD_MIN} required autoComplete="new-password" inputRef={pwRef} />
      <Field id="password_sahkan" label="Sahkan kata laluan baharu" name="password_sahkan" type={jenis} minLength={PASSWORD_MIN} required autoComplete="new-password" inputRef={sahkanRef} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button type="button" variant="secondary" onClick={cadang} className="w-auto">Cadang kata laluan</Button>
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" checked={tunjuk} onChange={(e) => setTunjuk(e.target.checked)} className="size-5" />
          Tunjuk kata laluan
        </label>
      </div>
      {state?.error && <FormError>{state.error}</FormError>}
      <Button type="submit" loading={pending}>{pending ? "Sedang simpan..." : "Tetapkan kata laluan"}</Button>
    </form>
  );
}
