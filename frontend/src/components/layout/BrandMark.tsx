import Link from "next/link";
import type { MouseEventHandler } from "react";

// STEP 1 — the Sasscout wordmark as one component. Used by Nav, Footer, and
// every app-page header so the brand (and its dark-theme contrast) is defined
// in exactly one place: bg-brand + text-brand-ink flips with the theme.

export function BrandMark({
  href = "/",
  onClick,
}: {
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-ink shadow-card">
        S
      </span>
      <span className="text-lg font-semibold tracking-tight text-ink">Sasscout</span>
    </Link>
  );
}