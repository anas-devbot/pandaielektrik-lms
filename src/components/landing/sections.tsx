import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Block, LANDING } from "@/content/landing";
import type { LandingStats } from "@/lib/landing-stats";

// Blok approved:false hanya dipaparkan dalam pratonton, dengan label DRAF. Awam tidak nampak penanda tempat.
export function DraftBox({ preview, children }: { preview: boolean; children: ReactNode }) {
  if (!preview) return null;
  return (
    <div className="rounded-lg border border-dashed border-warning p-3">
      <p className="mb-2 text-xs font-semibold text-warning">DRAF: menunggu AHZ</p>
      {children}
    </div>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-12">
      <h2 className="font-serif text-2xl font-semibold leading-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Item hanya dipaparkan bila nilainya wujud dan > 0 (tiada "0 video"). Semua nilai dari DB.
export function StatStrip({ stats }: { stats: LandingStats }) {
  const items: { big: string; label: string }[] = [];
  if (stats.videos > 0) items.push({ big: String(stats.videos), label: "video pelajaran" });
  if (stats.chapters > 0) items.push({ big: String(stats.chapters), label: "bab dalam ebook" });
  if (stats.examQuestions) items.push({ big: String(stats.examQuestions), label: "soalan ujian akhir" });
  if (stats.accessMonths) items.push({ big: `${stats.accessMonths} bulan`, label: "akses" });
  if (items.length === 0) return null;
  return (
    <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border border-border bg-surface p-3">
          <dt className="sr-only">{i.label}</dt>
          <dd className="font-serif text-2xl font-semibold leading-none tabular-nums">{i.big}<span className="mt-1 block font-sans text-xs font-normal text-muted">{i.label}</span></dd>
        </div>
      ))}
    </dl>
  );
}

export function Checklist({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-[15px]">
          <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 fill-none stroke-ink" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function NotFor({ items }: { items: readonly string[] }) {
  return (
    <div className="rounded-lg border border-ink bg-surface p-4">
      <ul className="flex flex-col gap-2 text-[15px]">
        {items.map((t) => <li key={t} className="flex gap-3"><span aria-hidden className="font-bold">&times;</span><span>{t}</span></li>)}
      </ul>
    </div>
  );
}

export function Instructor({ block, preview }: { block: typeof LANDING.instructor; preview: boolean }) {
  const v = block.value;
  const card = (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-4">
        {v.photo
          ? <Image src={v.photo} alt={`Gambar ${v.name}`} width={72} height={72} className="size-[72px] shrink-0 rounded-full border-2 border-gold object-cover" />
          : <span aria-hidden className="grid size-[72px] shrink-0 place-items-center rounded-full bg-ink font-serif text-2xl font-bold text-gold">{v.name.slice(0, 1)}</span>}
        <div>
          <p className="font-serif text-lg font-semibold leading-tight">{v.name}</p>
          <p className="mt-1 text-sm text-muted">{v.role}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3 text-sm">{v.paragraphs.map((p) => <p key={p}>{p}</p>)}</div>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
        {v.stats.map((x) => (
          <div key={x.big}>
            <dt className="font-serif text-2xl font-bold text-gold-text">{x.big}</dt>
            <dd className="mt-1 text-xs text-muted">{x.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
  return block.approved ? card : <DraftBox preview={preview}>{card}</DraftBox>;
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-surface">
      {items.map((f) => (
        <details key={f.q} className="group px-4">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-info">{f.q}<span aria-hidden className="shrink-0 group-open:rotate-45">+</span></summary>
          <p className="pb-3 text-sm text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function RefundNote({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
      {paragraphs.map((t) => <p key={t}>{t}</p>)}
      <p><Link href="/terma" className="font-semibold text-gold-text underline underline-offset-4">Baca terma dan syarat</Link></p>
    </div>
  );
}

// Bar bawah melekat pada telefon sahaja. Harga dan pautan terma berhampiran butang.
export function StickyCta({ href, label, priceText }: { href: string; label: string; priceText: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="shrink-0 leading-tight"><p className="font-serif text-lg font-semibold">{priceText}</p><Link href="/terma" className="text-xs text-gold-text underline underline-offset-2">Terma</Link></div>
        <Link href={href} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md border border-b-[3px] border-ink border-b-gold bg-ink px-5 text-base font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info">{label}</Link>
      </div>
    </div>
  );
}

// Petikan peserta: satu kad utama gelap (satu-satunya momen berani), selebihnya kad tenang. Teks asal peserta, tanpa suntingan.
export function Testimonials({ block, note }: { block: Block<{ quote: string; name: string; featured: boolean }[]>; note: string }) {
  const [first, ...rest] = [...block.value].sort((a, b) => Number(b.featured) - Number(a.featured));
  if (!first) return null;
  return (
    <div>
      <figure className="relative overflow-hidden rounded-xl bg-ink p-6 text-paper">
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gold" />
        <span aria-hidden className="font-serif text-6xl leading-none text-gold">&ldquo;</span>
        <blockquote className="-mt-3 font-serif text-2xl font-semibold leading-snug">{first.quote}</blockquote>
        <figcaption className="mt-4 text-sm"><span className="font-semibold">{first.name}</span><span className="block opacity-70">Peserta kelas langsung</span></figcaption>
      </figure>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {rest.map((t) => (
          <figure key={t.name} className="rounded-xl border border-border border-l-4 border-l-gold bg-surface p-4">
            <blockquote className="text-[15px] leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="mt-3 text-sm"><span className="font-semibold">{t.name}</span><span className="block text-muted">Peserta kelas langsung</span></figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{note}</p>
    </div>
  );
}
