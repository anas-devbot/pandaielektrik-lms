"use client";
import { useActionState } from "react";
import { mohonRefund, muatNaikSurat } from "./actions";

const Msg = ({ s }: { s?: { error?: string; ok?: string } }) => (<>
  {s?.error && <p role="alert" className="text-sm text-red-600">{s.error}</p>}
  {s?.ok && <p role="status" className="text-sm text-green-700">{s.ok}</p>}
</>);

export function MohonForm() {
  const [s, a, p] = useActionState(mohonRefund, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <textarea name="reason" rows={3} maxLength={500} placeholder="Sebab (pilihan)" className="rounded border p-2 text-sm" />
      <label className="flex items-start gap-2 text-sm"><input name="confirm" type="checkbox" required className="mt-1" />
        <span>Saya faham permohonan ini tertakluk kepada terma dan syarat, dan jika refund diluluskan, akses saya akan ditutup dan sijil (jika ada) dibatalkan.</span></label>
      <Msg s={s} />
      <button disabled={p} className="rounded bg-black p-2 text-white disabled:opacity-50">Mohon refund</button>
    </form>
  );
}

export function SuratForm({ request }: { request: string }) {
  const [s, a, p] = useActionState(muatNaikSurat, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="request" value={request} />
      <label className="text-sm">Surat bertandatangan (JPG, PNG atau HEIC)
        <input name="surat" type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" required className="mt-1 block" /></label>
      <Msg s={s} />
      <button disabled={p} className="rounded bg-black p-2 text-white disabled:opacity-50">{p ? "Sedang hantar..." : "Muat naik surat"}</button>
    </form>
  );
}
