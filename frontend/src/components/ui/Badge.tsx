import type { ReactNode } from "react";

// STEP 1 primitive — status pill. Meaning comes from the text label, tone is
// decorative (never color-only). Optional `dot` adds a leading marker.

type Tone = "neutral" | "brand" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-2",
  brand: "bg-brand-soft text-emerald-900 border border-brand-line",
  warn: "bg-warn-soft text-amber-900 border border-amber-200",
  danger: "bg-danger-soft text-red-700 border border-red-200",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-ink-3",
  brand: "bg-brand",
  warn: "bg-warn",
  danger: "bg-danger",
};

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className = "",
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}
    >
      {dot && <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOTS[tone]}`} />}
      {children}
    </span>
  );
}