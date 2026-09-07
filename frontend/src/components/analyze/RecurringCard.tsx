import type { RecurringSummary } from "@/lib/recurring/types";
import { statusLabel } from "./recurringLabels";
import { Donut } from "@/components/ui/Donut";

export function RecurringCard({ s }: { s: RecurringSummary }) {
  const rows = [
    { key: "likelyRecurringCount" as const, label: statusLabel.likely_recurring, cls: "text-emerald-700" },
    { key: "possiblyRecurringCount" as const, label: statusLabel.possibly_recurring, cls: "text-amber-700" },
    { key: "notRecurringCount" as const, label: statusLabel.not_recurring, cls: "text-zinc-700" },
    { key: "insufficientDataCount" as const, label: statusLabel.insufficient_data, cls: "text-zinc-500" },
  ];

  const donutSegments = rows.map((r) => ({
    label: r.label,
    value: s[r.key],
    color:
      r.key === "likelyRecurringCount"
        ? "var(--color-brand)"
        : r.key === "possiblyRecurringCount"
          ? "var(--color-warn)"
          : r.key === "notRecurringCount"
            ? "var(--color-ink)"
            : "var(--color-ink-2)",
  }));

  return (
    <div className="overflow-hidden border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <p className="font-mono text-[11px] text-ink-3 lowercase">recurring patterns</p>
        <h2 className="font-display text-lg text-ink">Recurring Patterns</h2>
        <p className="mt-0.5 text-xs text-ink-2">
          Detected payment patterns, not guaranteed subscriptions.
        </p>
      </div>
      <div className="px-5 py-4">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Donut
            segments={donutSegments.map((r) => ({ label: r.label, value: r.value }))}
            size={140}
            strokeWidth={14}
          />
          <dl className="grid grid-cols-2 gap-3">
            {rows.map((r) => (
              <div key={r.key} className="rounded bg-surface-muted px-4 py-3">
                <dt className="font-mono text-[11px] text-ink-3 lowercase">{r.label}</dt>
                <dd className={`mt-1 text-xl font-semibold tabular-nums ${r.cls}`}>
                  {s[r.key].toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-4 rounded bg-surface-muted px-4 py-3 font-mono text-[11px] text-ink-3">
          Based on {s.totalAnalyzed.toLocaleString()} merchant identities. A merchant can be
          recurring without being a software subscription.
        </p>
      </div>
    </div>
  );
}