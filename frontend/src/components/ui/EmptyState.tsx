import type { ReactNode } from "react";

// STEP 1 primitive — centered empty/quiet-state block with an optional action.

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface-muted/50 px-6 py-12 text-center">
      {icon ? <div aria-hidden="true" className="mb-4 text-ink-3">{icon}</div> : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <div className="mt-1.5 max-w-md text-sm leading-6 text-ink-2">{description}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}