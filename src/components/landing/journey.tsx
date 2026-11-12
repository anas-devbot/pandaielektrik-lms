// Laluan program ikut LMS sebenar (7 langkah, cabang di langkah 6). HTML + token sahaja.
type Step = { n: number; title: string; text: string };
type Branch = { title: string; text: string };

export function Journey({ steps, branches }: { steps: readonly Step[]; branches: readonly Branch[] }) {
  return (
    <ol className="relative ml-4 border-l-2 border-ink">
      {steps.map((s) => (
        <li key={s.n} className="relative pb-6 pl-8 last:pb-0">
          <span aria-hidden className="absolute -left-[17px] top-0 grid size-8 place-items-center rounded-full border-2 border-ink bg-paper font-serif text-sm font-bold">{s.n}</span>
          <h3 className="font-serif text-lg font-semibold leading-snug">{s.title}</h3>
          <p className="mt-0.5 text-sm text-muted">{s.text}</p>
          {s.n === 6 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {branches.map((b) => (
                <div key={b.title} className="rounded-lg border border-border bg-surface p-3 shadow-[inset_0_3px_0_var(--gold)]">
                  <p className="text-sm font-semibold">{b.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{b.text}</p>
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
