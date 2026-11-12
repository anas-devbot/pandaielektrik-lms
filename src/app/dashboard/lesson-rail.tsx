import Link from "next/link";

export type RailItem = { id: string; no: number | null; title: string; durationSeconds: number; percent: number; done: boolean; current: boolean };

// Senarai video sebagai laluan menegak. Item melebihi previewCount dilipat dalam <details> asli.
export function LessonRail({ items, active, previewCount = 8 }: { items: RailItem[]; active: boolean; previewCount?: number }) {
  const head = items.slice(0, previewCount);
  const rest = items.slice(previewCount);
  const restHasCurrent = rest.some((i) => i.current);
  return (
    <div>
      <ol className="ml-3 border-l-2 border-border">
        {head.map((i) => <Row key={i.id} i={i} active={active} />)}
        {rest.length > 0 && (
          <li className="list-none">
            <details open={restHasCurrent}>
              <summary className="cursor-pointer py-3 pl-5 text-sm font-semibold text-gold-text underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-info">
                Tunjuk {rest.length} video lagi
              </summary>
              <ol>{rest.map((i) => <Row key={i.id} i={i} active={active} />)}</ol>
            </details>
          </li>
        )}
      </ol>
    </div>
  );
}

function Row({ i, active }: { i: RailItem; active: boolean }) {
  const mins = Math.max(1, Math.round(i.durationSeconds / 60));
  const node = i.done ? "border-ink bg-ink" : i.current ? "border-gold bg-gold ring-4 ring-gold/20" : "border-border bg-paper";
  return (
    <li className={`relative list-none py-2.5 pl-5 pr-2 ${i.current ? "my-1 rounded-lg border border-gold bg-surface" : ""}`}>
      <span aria-hidden className={`absolute -left-[9px] top-4 size-4 rounded-full border-2 ${node}`} />
      <div className="flex items-start gap-2">
        <span className="w-6 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-muted">{i.no ?? "-"}</span>
        <div className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold leading-snug">
            {active ? <Link className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-info" href={`/belajar/${i.id}`}>{i.title}</Link> : i.title}
          </span>
          <span className="text-xs text-muted">{mins} min</span>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-label={`Kemajuan ${i.title}`} aria-valuenow={i.percent} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-1 rounded-full ${i.done ? "bg-ink" : "bg-gold"}`} style={{ width: `${i.percent}%` }} />
          </div>
        </div>
        <span className={`shrink-0 pt-0.5 text-sm tabular-nums ${i.done ? "font-semibold text-success" : "text-muted"}`}>{i.done ? "Selesai" : `${i.percent}%`}</span>
      </div>
    </li>
  );
}
