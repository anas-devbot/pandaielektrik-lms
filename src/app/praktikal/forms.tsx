"use client";
import { useActionState } from "react";
import { hantarBorang, isytiharVideo, pilihTrekPraktikal } from "./actions";
import { buttonClass } from "@/components/button";

const Msg = ({ s }: { s?: { error?: string; ok?: string } }) => (<>
  {s?.error && <p role="alert" className="text-sm text-error">{s.error}</p>}
  {s?.ok && <p role="status" className="text-sm text-success">{s.ok}</p>}
</>);

export function PilihTrekForm() {
  const [s, a, p] = useActionState(pilihTrekPraktikal, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <label className="flex items-start gap-2 text-sm"><input name="confirm" type="checkbox" required className="mt-1" />
        <span>Saya faham trek tidak boleh ditukar selepas dipilih.</span></label>
      <Msg s={s} />
      <button disabled={p} className={buttonClass("primary")}>Pilih trek teori dan praktikal</button>
    </form>
  );
}

export function BorangForm() {
  const [s, a, p] = useActionState(hantarBorang, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <label className="text-sm">Borang bertandatangan (JPG, PNG atau HEIC)
        <input name="form" type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" required className="mt-1 block" /></label>
      <Msg s={s} />
      <button disabled={p} className={buttonClass("primary")}>{p ? "Sedang hantar..." : "Hantar borang"}</button>
    </form>
  );
}

export function VideoForm({ notice }: { notice: string }) {
  const [s, a, p] = useActionState(isytiharVideo, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <section className="rounded-md border border-border bg-surface bg-surface p-3 text-sm text-ink"><h3 className="font-medium">Notis privasi Telegram group</h3><p className="mt-1">{notice}</p></section>
      <label className="flex items-start gap-2 text-sm"><input name="consent" type="checkbox" required className="mt-1" />
        <span>Saya telah membaca dan bersetuju. Saya sudah menghantar video pengujian ke Telegram group SEBELUM memasukkan sebarang bekalan.</span></label>
      <label className="text-sm">Rujukan video di Telegram (cth. tarikh dan masa dihantar)
        <input name="ref" required minLength={3} maxLength={200} className="mt-1 block w-full rounded-md border border-border bg-surface p-2" /></label>
      <Msg s={s} />
      <button disabled={p} className={buttonClass("primary")}>Isytihar video dihantar</button>
    </form>
  );
}
