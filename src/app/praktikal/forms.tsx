"use client";
import { useActionState } from "react";
import { hantarBorang, isytiharVideo, pilihTrekPraktikal } from "./actions";

const Msg = ({ s }: { s?: { error?: string; ok?: string } }) => (<>
  {s?.error && <p role="alert" className="text-sm text-red-600">{s.error}</p>}
  {s?.ok && <p role="status" className="text-sm text-green-700">{s.ok}</p>}
</>);

export function PilihTrekForm() {
  const [s, a, p] = useActionState(pilihTrekPraktikal, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <label className="flex items-start gap-2 text-sm"><input name="confirm" type="checkbox" required className="mt-1" />
        <span>Saya faham trek tidak boleh ditukar selepas dipilih.</span></label>
      <Msg s={s} />
      <button disabled={p} className="rounded bg-black p-2 text-white disabled:opacity-50">Pilih trek teori dan praktikal</button>
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
      <button disabled={p} className="rounded bg-black p-2 text-white disabled:opacity-50">{p ? "Sedang hantar..." : "Hantar borang"}</button>
    </form>
  );
}

export function VideoForm({ notice }: { notice: string }) {
  const [s, a, p] = useActionState(isytiharVideo, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <section className="rounded border bg-zinc-50 p-3 text-sm text-black"><h3 className="font-medium">Notis privasi Telegram group</h3><p className="mt-1">{notice}</p></section>
      <label className="flex items-start gap-2 text-sm"><input name="consent" type="checkbox" required className="mt-1" />
        <span>Saya telah membaca dan bersetuju. Saya sudah menghantar video pengujian ke Telegram group SEBELUM memasukkan sebarang bekalan.</span></label>
      <label className="text-sm">Rujukan video di Telegram (cth. tarikh dan masa dihantar)
        <input name="ref" required minLength={3} maxLength={200} className="mt-1 block w-full rounded border p-2" /></label>
      <Msg s={s} />
      <button disabled={p} className="rounded bg-black p-2 text-white disabled:opacity-50">Isytihar video dihantar</button>
    </form>
  );
}
