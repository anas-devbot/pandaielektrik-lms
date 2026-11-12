"use client";
import { useActionState, useRef, useState } from "react";
import { daftar } from "./actions";
import { PASSWORD_MIN, cadangKataLaluan } from "@/lib/password";
import { JANTINA, JULAT_UMUR, NEGERI } from "@/lib/profil";
import { Button } from "@/components/button";

export default function DaftarForm({ notice }: { notice: { title: string; org: string; intro: string; sections: readonly { heading: string; paragraphs: readonly string[] }[]; closing: readonly string[] } }) {
  const [state, action, pending] = useActionState(daftar, undefined);
  const pwRef = useRef<HTMLInputElement>(null);
  const [tunjuk, setTunjuk] = useState(false);
  const cadang = () => {
    if (pwRef.current) pwRef.current.value = cadangKataLaluan();
    setTunjuk(true); // supaya pelajar boleh baca dan simpan kata laluan cadangan
  };
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input name="full_name" defaultValue={state?.fullName} placeholder="Nama penuh (seperti pada sijil)" required autoComplete="name" className="rounded-md border border-border bg-surface p-3" />
      <p className="-mt-2 text-xs text-muted">Guna nama sebenar. Nama ini akan dipaparkan pada sijil anda.</p>
      <input name="email" type="email" defaultValue={state?.email} placeholder="Emel" required autoComplete="email" className="rounded-md border border-border bg-surface p-3" />
      <input ref={pwRef} name="password" type={tunjuk ? "text" : "password"} placeholder={`Kata laluan (min ${PASSWORD_MIN})`} minLength={PASSWORD_MIN} required autoComplete="new-password" className="rounded-md border border-border bg-surface p-3" />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button type="button" variant="secondary" onClick={cadang} className="w-auto">Cadang kata laluan</Button>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={tunjuk} onChange={(e) => setTunjuk(e.target.checked)} />
          Tunjuk kata laluan
        </label>
      </div>
      <input name="phone" type="tel" defaultValue={state?.phone} placeholder="Nombor telefon (cth 012-3456789)" required autoComplete="tel" className="rounded-md border border-border bg-surface p-3" />
      <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3 text-sm">
        <legend className="px-1 font-medium">Maklumat tambahan (pilihan)</legend>
        <p className="text-xs text-muted">Boleh dibiarkan kosong. Digunakan untuk tujuan yang dinyatakan dalam notis privasi.</p>
        <select name="state" defaultValue={state?.state ?? ""} className="rounded-md border border-border bg-surface p-3">
          <option value="">Negeri: tidak mahu nyatakan</option>
          {NEGERI.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <input name="district" defaultValue={state?.district} placeholder="Daerah (cth Petaling)" className="rounded-md border border-border bg-surface p-3" />
        <select name="gender" defaultValue={state?.gender ?? ""} className="rounded-md border border-border bg-surface p-3">
          <option value="">Jantina: tidak mahu nyatakan</option>
          {JANTINA.map((j) => <option key={j.nilai} value={j.nilai}>{j.label}</option>)}
        </select>
        <select name="age_range" defaultValue={state?.ageRange ?? ""} className="rounded-md border border-border bg-surface p-3">
          <option value="">Umur: tidak mahu nyatakan</option>
          {JULAT_UMUR.map((j) => <option key={j.nilai} value={j.nilai}>{j.label}</option>)}
        </select>
      </fieldset>
      <section className="max-h-96 overflow-y-auto rounded-md border border-border bg-surface p-3 text-sm text-ink">
        <h2 className="font-medium">{notice.title}</h2>
        <p className="mt-1 font-medium">{notice.org}</p>
        <p className="mt-2">{notice.intro}</p>
        {notice.sections.map((s) => (
          <div key={s.heading} className="mt-3">
            <h3 className="font-medium">{s.heading}</h3>
            {s.paragraphs.map((t) => <p key={t} className="mt-1">{t}</p>)}
          </div>
        ))}
        {notice.closing.map((t) => <p key={t} className="mt-3">{t}</p>)}
      </section>
      <label className="flex items-start gap-2 text-sm">
        <input name="privacy" type="checkbox" required className="mt-1" />
        <span>Saya telah membaca dan bersetuju dengan notis privasi di atas.</span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-error">{state.error}</p>}
      <Button type="submit" loading={pending}>Daftar</Button>
    </form>
  );
}
