"use client";

import { useCountUp, useInView } from "@/lib/motion";

// Counts from 0 to `value` when scrolled into view. Shows the final value
// immediately under prefers-reduced-motion and before hydration. Props stay
// serializable (RSC-safe): no function props, use `variant`/`suffix`.
export function AnimatedNumber({
  value,
  variant = "integer",
  suffix = "",
  className,
}: {
  value: number;
  variant?: "usd" | "integer";
  suffix?: string;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const shown = useCountUp(value, inView);
  const text =
    variant === "usd"
      ? `$${Math.round(shown).toLocaleString("en-US")}`
      : `${Math.round(shown)}`;
  return (
    <span ref={ref} className={className}>
      {text}
      {suffix}
    </span>
  );
}