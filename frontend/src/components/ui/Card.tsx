import type { ReactNode } from "react";

// STEP 1 primitive — elevated surface container. `interactive` gives a hover
// lift for clickable panels (nav cards, review rows) that stays within motion
// budget: transform/opacity only, disabled under reduced motion.

export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface text-ink shadow-card ${
        interactive
          ? "transition-[box-shadow,transform,border-color] duration-200 ease-smooth hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}