import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs text-brand">↳ {eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">{title}</h2>
      {sub ? <p className="mt-4 text-lg leading-8 text-ink-2">{sub}</p> : null}
    </div>
  );
}