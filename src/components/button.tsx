import type { ButtonHTMLAttributes } from "react";

// Butang ikut DESIGN.md (bahagian Butang). Sasaran sentuh 48px. Penuh lebar pada telefon.
// Satu primary setiap skrin. Gunakan tertiary untuk pautan kecil.
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";

const base =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-5 text-base font-semibold transition-[transform,opacity] duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto";

const variants: Record<ButtonVariant, string> = {
  primary: "border border-b-[3px] border-ink border-b-gold bg-ink text-paper hover:opacity-90",
  secondary: "border border-ink bg-transparent text-ink",
  tertiary: "min-h-12 w-auto justify-start rounded-none px-0 text-gold-text underline underline-offset-4",
  danger: "border border-error bg-transparent text-error",
};

// Gaya yang sama untuk pautan yang kelihatan seperti butang (contoh: CTA landing).
export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, className)}
    >
      {loading ? "Memproses…" : children}
    </button>
  );
}
