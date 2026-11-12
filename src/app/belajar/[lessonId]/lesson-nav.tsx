import Link from "next/link";

// Bar bawah melekat (ibu jari sampai): Dashboard dan Video seterusnya. Hanya pautan sedia ada.
export function LessonNav({ next }: { next: { id: string; no: number | null; title: string } | null }) {
  return (
    <nav aria-label="Navigasi video" className="sticky bottom-0 -mx-4 mt-6 grid grid-cols-[auto_1fr] gap-2 bg-gradient-to-t from-paper from-70% to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 sm:-mx-6 sm:px-6">
      <Link href="/dashboard" className="inline-flex min-h-[50px] items-center justify-center rounded-md border border-ink bg-surface px-5 text-base font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info">Dashboard</Link>
      {next && (
        <Link href={`/belajar/${next.id}`} className="inline-flex min-h-[50px] min-w-0 flex-col items-center justify-center rounded-md border border-b-[3px] border-ink border-b-gold bg-ink px-4 py-1 text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info">
          <span className="text-base font-semibold">Video seterusnya</span>
          <span className="block max-w-full truncate text-xs opacity-80">{next.no != null ? `${next.no}. ` : ""}{next.title} &rarr;</span>
        </Link>
      )}
    </nav>
  );
}
