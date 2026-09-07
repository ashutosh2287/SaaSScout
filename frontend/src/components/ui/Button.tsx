import type { ButtonHTMLAttributes, ReactNode } from "react";

// STEP 1 primitives — token-native, no dependencies. `buttonClasses` is
// exported so Link-based CTAs (landing, page headers) share the exact same
// visual language as <Button>.

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-ink shadow-card hover:bg-brand-hover active:translate-y-px",
  secondary:
    "border border-line-strong bg-surface text-ink shadow-card hover:bg-surface-muted active:translate-y-px",
  ghost: "text-ink-2 hover:bg-surface-muted hover:text-ink",
  danger: "bg-danger text-brand-ink shadow-card hover:opacity-90 active:translate-y-px",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,box-shadow,transform] duration-150 ease-smooth focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0";

export function buttonClasses(variant: Variant = "primary", size: Size = "md"): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <button type="button" className={`${buttonClasses(variant, size)} ${className}`} {...props}>
      {children}
    </button>
  );
}