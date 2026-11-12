import Image from "next/image";
import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from "react";

// Pembungkus halaman akaun (log masuk, daftar dan lain-lain): jenama di atas, kad dengan garis emas.
export function AuthShell({ title, lead, context, children, below }: { title: string; lead?: string; context?: ReactNode; children: ReactNode; below?: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <Image src="/icon.png" alt="" width={56} height={56} className="size-14 rounded-full border-[3px] border-gold" priority />
        <p className="font-serif text-xl font-semibold leading-tight">Pandai Elektrik<span className="block font-sans text-sm font-normal text-muted">AHZ Teknik</span></p>
      </div>
      {context}
      <div className="relative rounded-xl border border-border bg-surface p-5">
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gold" />
        <h1 className="font-serif text-2xl font-semibold leading-tight">{title}</h1>
        {lead && <p className="mb-4 mt-1 text-sm text-muted">{lead}</p>}
        {children}
      </div>
      {below && <div className="mt-4 text-center text-sm text-muted">{below}</div>}
    </main>
  );
}

export const inputCls = "min-h-12 w-full rounded-md border border-border bg-surface px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-info";

// Label sentiasa kelihatan (bukan placeholder sahaja).
export function Field({ label, help, id, inputRef, ...rest }: { label: string; help?: string; id: string; inputRef?: Ref<HTMLInputElement> } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      <input id={id} ref={inputRef} aria-describedby={help ? `${id}-h` : undefined} {...rest} className={inputCls} />
      {help && <p id={`${id}-h`} className="mt-1 text-xs text-muted">{help}</p>}
    </div>
  );
}

export function SelectField({ label, id, children, ...rest }: { label: string; id: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      <select id={id} {...rest} className={inputCls}>{children}</select>
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-md border border-error bg-surface px-3 py-2.5 text-sm text-error">{children}</p>;
}

export const linkCls = "font-semibold text-gold-text underline underline-offset-4";
