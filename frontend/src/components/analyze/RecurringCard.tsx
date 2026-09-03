import type { RecurringSummary } from "@/lib/recurring/types";
import { statusLabel } from "./recurringLabels";

export function RecurringCard({ s }: { s: RecurringSummary }) {
  const rows = [
    { key: "likelyRecurringCount" as const, label: statusLabel.likely_recurring, cls: "text-emerald-700" },
    { key: "possiblyRecurringCount" as const, label: statusLabel.possibly_recurring, cls: "text-amber-700" },
    { key: "notRecurringCount" as const, label: statusLabel.not_recurring, cls: "text-zinc-700" },
    { key: "insufficientDataCount" as const, label: statusLabel.insufficient_data, cls: "text-zinc-500" },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">Recurring patterns</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Detected payment patterns, not guaranteed subscriptions.
        </p>
      </div>
      <div className="px-5 py-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rows.map((r) => (
            <div key={r.key} className="rounded-lg bg-zinc-50 px-4 py-3">
              <dt className="text-xs text-zinc-500">{r.label}</dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${r.cls}`}>
                {s[r.key].toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 rounded-lg bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
          Based on {s.totalAnalyzed.toLocaleString()} merchant identities. A merchant can be
          recurring without being a software subscription.
        </p>
      </div>
    </div>
  );
}