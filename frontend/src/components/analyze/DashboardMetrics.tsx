import type { DashboardMetrics as Metrics } from "@/lib/dashboard";
import { formatMoney } from "@/lib/dashboard";
import { StoneBars } from "@/components/ui/StoneBars";

// Top-level key financial metrics. Values are the existing analysis outputs,
// re-presented only. Estimates are always labelled as estimates.

export function DashboardMetrics({ metrics, currency }: { metrics: Metrics; currency?: string | null }) {
  const stat = [
    {
      label: "software spend identified",
      value: formatMoney(metrics.softwareSpendIdentified, currency),
      cls: "text-ink",
      hint: "identified, not confirmed",
    },
    {
      label: "est. recurring software spend / mo",
      value: `${formatMoney(metrics.estimatedRecurringMonthly, currency)} / mo`,
      cls: "text-brand",
      hint: "estimated",
    },
    {
      label: "est. recurring software spend / yr",
      value: `${formatMoney(metrics.estimatedRecurringYearly, currency)} / yr`,
      cls: "text-brand",
      hint: "estimated",
    },
    {
      label: "merchants worth reviewing",
      value: metrics.merchantsWorthReviewing.toLocaleString(),
      cls: metrics.merchantsWorthReviewing > 0 ? "text-warn" : "text-ink",
      hint: "worth a closer look",
    },
  ];

  const numericValues = [
    metrics.softwareSpendIdentified ?? 0,
    metrics.estimatedRecurringMonthly ?? 0,
    metrics.estimatedRecurringYearly ?? 0,
    metrics.merchantsWorthReviewing,
  ];
  const maxVal = Math.max(...numericValues, 1);

  return (
    <div className="overflow-hidden border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <p className="font-mono text-[11px] text-ink-3 lowercase">at a glance</p>
        <h2 className="font-display text-lg text-ink">Metrics</h2>
        <p className="mt-0.5 text-xs text-ink-2">
          Estimated figures from the transaction data — likely labels, not guarantees.
        </p>
      </div>
      <div className="px-5 py-4">
        <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat.map((r) => (
            <div key={r.label} className="rounded bg-surface-muted px-4 py-3">
              <dt className="font-mono text-[11px] text-ink-3 lowercase">{r.label}</dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${r.cls}`}>{r.value}</dd>
              <dd className="mt-0.5 text-[11px] text-ink-3">{r.hint}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-line pt-4">
          <p className="mb-3 font-mono text-[11px] text-ink-3 lowercase">relative scale</p>
          <StoneBars
            items={stat.map((r, i) => ({
              label: r.label,
              value: numericValues[i],
            }))}
            max={maxVal}
          />
        </div>
      </div>
    </div>
  );
}
