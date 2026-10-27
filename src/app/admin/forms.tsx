"use client";
import { useActionState } from "react";
import { rekodManual, tambahPercubaan, tetapkanPautanTelegram, type AdminState } from "./actions";

const Msg = ({ s }: { s: AdminState }) => (<>
  {s?.error && <p role="alert" className="text-sm text-red-600">{s.error}</p>}
  {s?.ok && <p role="status" className="text-sm text-green-700">{s.ok}</p>}
</>);
const inp = "rounded border p-2 text-sm";

export function TambahPercubaan() {
  const [s, a, p] = useActionState(tambahPercubaan, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <input name="email" type="email" required placeholder="Emel pelajar" className={inp} />
      <input name="count" type="number" min={1} defaultValue={1} required className={inp} />
      <input name="reason" required placeholder="Sebab (wajib, direkod)" className={inp} />
      <Msg s={s} />
      <button disabled={p} className="rounded bg-black p-2 text-white disabled:opacity-50">Tambah percubaan</button>
    </form>
  );
}

export function RekodManual() {
  const [s, a, p] = useActionState(rekodManual, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <p className="text-sm">Hanya untuk sesi bantuan fasilitator. Pelajar sudah menghantar; penilai beri keputusan.</p>
      <input name="email" type="email" required placeholder="Emel pelajar" className={inp} />
      <select name="type" className={inp}><option value="subjective">Subjektif</option><option value="schematic">Skematik</option></select>
      <label className="text-sm">Tarikh terima <input name="received_at" type="date" required className={inp} /></label>
      <input name="reviewer_email" type="email" required placeholder="Emel penilai yang memberi keputusan" className={inp} />
      <select name="decision" className={inp}><option value="approved">Lulus</option><option value="rejected">Tolak</option></select>
      <textarea name="comment" rows={2} placeholder="Komen penilai (wajib jika tolak)" className={inp} />
      <textarea name="text" rows={3} placeholder="Jawapan subjektif (pilihan)" className={inp} />
      <label className="text-sm">Fail skematik (pilihan; jika tiada, ditanda &quot;fail di luar sistem&quot;) <input name="file" type="file" accept="image/*,.heic,.heif" /></label>
      <input name="reason" required placeholder="Sebab laluan manual (wajib, direkod)" className={inp} />
      <Msg s={s} />
      <button disabled={p} className="rounded bg-black p-2 text-white disabled:opacity-50">Rekod</button>
    </form>
  );
}

export function PautanTelegram() {
  const [s, a, p] = useActionState(tetapkanPautanTelegram, undefined);
  return (
    <form action={a} className="mt-2 flex flex-col gap-2">
      <input name="email" type="email" required placeholder="Emel pelajar" className={inp} />
      <input name="link" required placeholder="https://t.me/+..." className={inp} />
      <Msg s={s} />
      <button disabled={p} className="rounded bg-black p-2 text-white disabled:opacity-50">Tetapkan pautan</button>
    </form>
  );
}
