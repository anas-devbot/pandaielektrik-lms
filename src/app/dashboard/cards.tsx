import type { ReactNode } from "react";

// Kad tindakan seragam. Ikon SVG inline, hiasan sahaja (aria-hidden).
const ICON: Record<string, string> = {
  book: "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Zm4 0v4l2-1 2 1V5",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  check: "M5 12l4 4 10-10",
  cal: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
  tool: "M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9-2-2Z",
  cert: "M6 4h12v12H6zM9 20l3-3 3 3M9 8h6M9 11h6",
  pen: "M4 20l4-1 11-11-3-3L5 16l-1 4Z",
};

export function ActionCard({ icon, title, children, action }: { icon: keyof typeof ICON; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-paper">
        <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-ink" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[icon]} /></svg>
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold leading-snug">{title}</h2>
        {children && <div className="text-sm text-muted">{children}</div>}
      </div>
      {action && <div className="shrink-0 text-sm font-semibold text-gold-text">{action}</div>}
    </div>
  );
}
