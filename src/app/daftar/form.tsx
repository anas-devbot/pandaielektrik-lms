"use client";
import { useActionState, useRef, useState } from "react";
import { daftar } from "./actions";
import { PASSWORD_MIN, cadangKataLaluan } from "@/lib/password";
import { JANTINA, JULAT_UMUR, NEGERI } from "@/lib/profil";
import { Button } from "@/components/button";
import { Field, FormError, SelectField } from "@/components/auth";

export default function DaftarForm({ notice }: { notice: { title: string; org: string; intro: string; sections: readonly { heading: string; paragraphs: readonly string[] }[]; closing: readonly string[] } }) {
  const [state, action, pending] = useActionState(daftar, undefined);
  const pwRef = useRef<HTMLInputElement>(null);
  const [tunjuk, setTunjuk] = useState(false);
  const cadang = () => {
    if (pwRef.current) pwRef.current.value = cadangKataLaluan();
    setTunjuk(true); // supaya pelajar boleh baca dan simpan kata laluan cadangan
  };
  const tambahan = !!(state?.state || state?.district || state?.gender || state?.ageRange);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field id="full_name" label="Nama penuh (seperti pada sijil)" help="Guna nama sebenar. Nama ini akan dipaparkan pada sijil anda." name="full_name" defaultValue={state?.fullName} required autoComplete="name" />
      <Field id="email" label="Emel" name="email" type="email" defaultValue={state?.email} required autoComplete="email" />
      <Field id="password" label={`Kata laluan (min ${PASSWORD_MIN})`} name="password" type={tunjuk ? "text" : "password"} minLength={PASSWORD_MIN} required autoComplete="new-password" inputRef={pwRef} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button type="button" variant="secondary" onClick={cadang} className="w-auto">Cadang kata laluan</Button>
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" checked={tunjuk} onChange={(e) => setTunjuk(e.target.checked)} className="size-5" />
          Tunjuk kata laluan
        </label>
      </div>
      <Field id="phone" label="Nombor telefon" name="phone" type="tel" placeholder="cth 012-3456789" defaultValue={state?.phone} required autoComplete="tel" />

      <details open={tambahan} className="rounded-lg border border-border">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between px-3 text-sm font-semibold">Maklumat tambahan (pilihan)<span aria-hidden>+</span></summary>
        <div className="flex flex-col gap-3 px-3 pb-3">
          <p className="text-xs text-muted">Boleh dibiarkan kosong. Digunakan untuk tujuan yang dinyatakan dalam notis privasi.</p>
          <SelectField id="state" label="Negeri" name="state" defaultValue={state?.state ?? ""}>
            <option value="">Tidak mahu nyatakan</option>
            {NEGERI.map((n) => <option key={n} value={n}>{n}</option>)}
          </SelectField>
          <Field id="district" label="Daerah" name="district" placeholder="cth Petaling" defaultValue={state?.district} />
          <SelectField id="gender" label="Jantina" name="gender" defaultValue={state?.gender ?? ""}>
            <option value="">Tidak mahu nyatakan</option>
            {JANTINA.map((j) => <option key={j.nilai} value={j.nilai}>{j.label}</option>)}
          </SelectField>
          <SelectField id="age_range" label="Umur" name="age_range" defaultValue={state?.ageRange ?? ""}>
            <option value="">Tidak mahu nyatakan</option>
            {JULAT_UMUR.map((j) => <option key={j.nilai} value={j.nilai}>{j.label}</option>)}
          </SelectField>
        </div>
      </details>

      <section aria-labelledby="notis" className="rounded-lg border border-border bg-paper">
        <h2 id="notis" className="border-b border-border px-3 py-2.5 text-sm font-semibold">{notice.title}</h2>
        <div tabIndex={0} className="max-h-[130px] overflow-y-auto px-3 py-2.5 text-sm text-muted focus-visible:outline-2 focus-visible:outline-info">
          <p className="font-semibold text-ink">{notice.org}</p>
          <p className="mt-2">{notice.intro}</p>
          {notice.sections.map((s) => (
            <div key={s.heading} className="mt-3">
              <h3 className="font-semibold text-ink">{s.heading}</h3>
              {s.paragraphs.map((t) => <p key={t} className="mt-1">{t}</p>)}
            </div>
          ))}
          {notice.closing.map((t) => <p key={t} className="mt-3">{t}</p>)}
        </div>
      </section>
      <label className="flex items-start gap-3 text-sm">
        <input name="privacy" type="checkbox" required className="mt-0.5 size-5 shrink-0" />
        <span>Saya telah membaca dan bersetuju dengan notis privasi di atas.</span>
      </label>
      {state?.error && <FormError>{state.error}</FormError>}
      <Button type="submit" loading={pending}>Daftar</Button>
    </form>
  );
}
