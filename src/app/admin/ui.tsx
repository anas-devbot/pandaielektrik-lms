import Link from "next/link";

// Komponen paparan dashboard admin (tiada logik data).
export const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
export const Tile = ({ n, label, tone }: { n: number; label: string; tone?: "alert" | "gold" }) => (
  <div className={`rounded-lg border bg-surface p-3 ${n > 0 && tone === "alert" ? "border-warning shadow-[inset_0_3px_0_var(--warning)]" : n > 0 && tone === "gold" ? "border-border shadow-[inset_0_3px_0_var(--gold)]" : "border-border"}`}>
    <p className={`font-serif text-3xl font-semibold leading-none tabular-nums ${n === 0 ? "text-muted/60" : n > 0 && tone === "alert" ? "text-warning" : ""}`}>{n}</p>
    <p className="mt-1 text-xs text-muted">{label}</p>
  </div>
);
export const Box = ({ title, n, warn, children }: { title: string; n: number; warn?: boolean; children: React.ReactNode }) => (
  <section className={`mt-4 overflow-hidden rounded-lg border bg-surface ${warn && n > 0 ? "border-warning" : "border-border"}`}>
    <h2 className={`flex items-center justify-between border-b border-border px-3.5 py-3 text-[15px] font-semibold ${warn && n > 0 ? "text-warning" : ""}`}>{title}<span className="text-xs font-normal text-muted">{n}</span></h2>
    {n === 0 ? <p className="flex items-center gap-2 px-3.5 py-3 text-sm text-muted"><span aria-hidden className="font-bold text-success">&#10003;</span>Tiada yang menunggu.</p> : children}
  </section>
);
export const Person = ({ name, sub, right, href, action }: { name: string; sub?: React.ReactNode; right?: React.ReactNode; href?: string; action?: string }) => (
  <div className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 text-sm last:border-b-0">
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-xs font-bold">{initials(name)}</span>
    <div className="min-w-0 flex-1 leading-tight"><p className="truncate font-semibold">{name}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
    {right && <span className="shrink-0 text-xs tabular-nums text-muted">{right}</span>}
    {href && <Link href={href} className="shrink-0 font-semibold text-gold-text underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-info">{action ?? "Buka"}</Link>}
  </div>
);

