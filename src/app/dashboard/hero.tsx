import Link from "next/link";
import { stepFor } from "@/lib/dashboard-steps";

// Rupa sahaja: semua nilai dikira di page.tsx (server). Token warna sedia ada, tiada warna baharu.
export type HeroProps = {
  title: string;
  name: string;
  pctDone: number;
  done: number;
  total: number;
  accessText: string | null;
  resume: { id: string; title: string } | null;
  active: boolean;
  stage: string;
  stepText: string;
  daysLeft: number | null;
  examStatus: "Lulus" | "Dibuka" | "Terkunci";
};

export function Hero(p: HeroProps) {
  const step = stepFor(p.stage);
  return (
    <>
      <div className="pb-3 pt-1">
        <p className="text-sm text-muted">Selamat kembali</p>
        <p className="font-serif text-2xl font-semibold leading-tight">{p.name}</p>
      </div>

      <section className="relative overflow-hidden rounded-lg bg-ink p-4 text-paper">
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gold" />
        <div className="flex items-center gap-4">
          <div
            role="progressbar" aria-label="Kemajuan video" aria-valuenow={p.pctDone} aria-valuemin={0} aria-valuemax={100}
            className="grid size-[84px] shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(var(--gold) ${p.pctDone}%, var(--muted) 0)` }}
          >
            <div className="grid size-[66px] place-items-center rounded-full bg-ink text-center">
              <span className="font-serif text-xl font-bold leading-none">{p.pctDone}%<span className="block pt-0.5 font-sans text-[11px] font-normal opacity-70">{p.done} / {p.total}</span></span>
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-lg font-semibold leading-snug">{p.title}</h1>
            {p.accessText && <p className="mt-1 text-sm opacity-75">{p.accessText}</p>}
          </div>
        </div>
        {p.resume && p.active && (
          <>
            <p className="mt-4 break-words text-sm opacity-80">Seterusnya: <b className="font-semibold">{p.resume.title}</b></p>
            <Link
              href={`/belajar/${p.resume.id}`}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-md border border-b-[3px] border-paper border-b-gold bg-paper px-5 text-base font-semibold text-ink transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
            >
              Sambung tonton: <span className="ml-1 truncate">{p.resume.title}</span>
            </Link>
          </>
        )}
      </section>

      <section aria-labelledby="langkah" className="mt-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="langkah" className="text-sm font-semibold">Anda di langkah ini</h2>
          <span className="text-sm text-muted">Langkah {step.n} daripada {step.total}: {step.label}</span>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full ${i + 1 < step.n ? "bg-ink" : i + 1 === step.n ? "bg-gold" : "bg-border"}`} />
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{p.stepText}</p>
      </section>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat value={`${p.done}`} suffix={` / ${p.total}`} label="Video selesai" />
        <Stat value={p.daysLeft === null ? "-" : `${p.daysLeft}`} label={p.daysLeft === null ? "Akses" : "Hari akses berbaki"} />
        <Stat value={p.examStatus} small label="Ujian akhir" />
      </div>
    </>
  );
}

function Stat({ value, suffix, label, small }: { value: string; suffix?: string; label: string; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className={`font-serif font-semibold leading-tight tabular-nums ${small ? "text-base" : "text-2xl"}`}>
        {value}{suffix && <span className="text-sm font-normal text-muted">{suffix}</span>}
      </p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}
