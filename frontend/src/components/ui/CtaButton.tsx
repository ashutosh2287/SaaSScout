import Link from "next/link";
import type { ReactNode } from "react";

const styles = {
  primary:
    "inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-ink shadow-card transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
  secondary:
    "inline-flex items-center justify-center rounded-xl border border-line-strong bg-surface px-5 py-3 text-sm font-semibold text-ink shadow-card transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-strong",
} as const;

export function CtaButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={href} className={styles[variant]}>
      {children}
    </Link>
  );
}