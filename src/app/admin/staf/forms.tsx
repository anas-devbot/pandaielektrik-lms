"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/button";
import { Field, SelectField } from "@/components/auth";
import { nyahaktifStaf, tambahStaf, ubahPeranan, type StafState } from "./actions";

const ROLE_OPTS = [{ v: "reviewer", l: "reviewer (semak penghantaran)" }, { v: "approver", l: "approver (kelulusan bekalan)" }, { v: "admin", l: "admin (semua kuasa)" }];
const Msg = ({ s }: { s: StafState }) => (
  <>
    {s?.error && <p role="alert" className="rounded-md border border-error px-3 py-2 text-sm text-error">{s.error}</p>}
    {s?.ok && <p role="status" className="text-sm text-success">{s.ok}</p>}
  </>
);

export function TambahStafForm() {
  const [s, a, p] = useActionState(tambahStaf, undefined);
  const [copied, setCopied] = useState(false);
  return (
    <form action={a} className="flex flex-col gap-3">
      <Field id="staf-email" label="Emel" name="email" type="email" required autoComplete="off" defaultValue={s?.v?.email} />
      <Field id="staf-name" label="Nama penuh" name="name" required autoComplete="off" defaultValue={s?.v?.name} />
      <SelectField id="staf-role" label="Peranan" name="role" defaultValue={s?.v?.role ?? "reviewer"}>
        {ROLE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </SelectField>
      <label className="flex items-start gap-3 text-sm">
        <input name="confirm_student" type="checkbox" className="mt-0.5 size-5 shrink-0" />
        <span>Jika emel ini sudah berdaftar sebagai <b>pelajar</b>, saya sahkan mahu menjadikannya staf (kata laluan mereka tidak diubah).</span>
      </label>
      <Msg s={s} />
      {s?.tempPassword && (
        <div className="rounded-lg border border-gold bg-paper p-3 text-sm" role="status">
          <p className="font-semibold">Kata laluan sementara untuk {s.email} (dipaparkan SEKALI sahaja)</p>
          <p className="mt-2 flex items-center gap-2">
            <code className="rounded bg-surface px-2 py-1 font-mono text-base select-all">{s.tempPassword}</code>
            <button type="button" className="text-sm font-semibold text-gold-text underline underline-offset-4"
              onClick={() => { navigator.clipboard?.writeText(s.tempPassword!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); }}>{copied ? "Disalin" : "Salin"}</button>
          </p>
          <p className="mt-2 text-xs text-muted">Hantar kepada staf secara selamat dan minta mereka menukarnya selepas log masuk (Lupa kata laluan). Ia tidak disimpan di mana-mana dan hilang bila halaman dimuat semula.</p>
        </div>
      )}
      <Button type="submit" loading={p}>Tambah staf</Button>
    </form>
  );
}

export function UbahPerananForm({ target, role }: { target: string; role: string }) {
  const [s, a, p] = useActionState(ubahPeranan, undefined);
  return (
    <form action={a} className="flex flex-col gap-2">
      <input type="hidden" name="target" value={target} />
      <SelectField id={`r-${target}`} label="Peranan baharu" name="role" defaultValue={role}>
        {ROLE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </SelectField>
      <Field id={`rs-${target}`} label="Sebab (wajib)" name="reason" required />
      <Msg s={s} />
      <Button type="submit" variant="secondary" loading={p} className="sm:w-auto">Simpan peranan</Button>
    </form>
  );
}

export function NyahaktifForm({ target }: { target: string }) {
  const [s, a, p] = useActionState(nyahaktifStaf, undefined);
  return (
    <form action={a} className="flex flex-col gap-2">
      <input type="hidden" name="target" value={target} />
      <p className="text-xs text-muted">Peranan dibuang dan log masuk disekat. Akaun dan semua rekod kelulusan/penilaian kekal (tidak dipadam).</p>
      <Field id={`d-${target}`} label="Sebab (wajib)" name="reason" required />
      <label className="flex items-start gap-3 text-sm"><input name="confirm" type="checkbox" className="mt-0.5 size-5 shrink-0" /><span>Saya sahkan mahu menyahaktifkan staf ini.</span></label>
      <Msg s={s} />
      <Button type="submit" variant="danger" loading={p} className="sm:w-auto">Nyahaktif</Button>
    </form>
  );
}
