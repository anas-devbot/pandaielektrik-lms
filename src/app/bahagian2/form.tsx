"use client";
import { useActionState } from "react";
import { hantarBahagian2 } from "./actions";

export default function Part2Form({ needText, needFile, maxMb }: { needText: boolean; needFile: boolean; maxMb: number }) {
  const [state, action, pending] = useActionState(hantarBahagian2, undefined);
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      {needText && <textarea name="subjective" rows={8} maxLength={20000} placeholder="Jawapan subjektif anda" className="rounded border p-2" />}
      {needFile && (
        <label className="text-sm">Skematik (JPG, PNG atau HEIC, maksimum {maxMb} MB)
          <input name="schematic" type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" className="mt-1 block" />
        </label>
      )}
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-green-700">{state.ok}</p>}
      <button disabled={pending} className="rounded bg-black p-2 text-white disabled:opacity-50">{pending ? "Sedang hantar..." : "Hantar"}</button>
    </form>
  );
}
