import type { DashboardMetrics as Metrics } from "@/lib/dashboard";
import { formatMoney } from "@/lib/dashboard";

// Top-level key financial metrics. Values are the existing analysis outputs,
// re-presented only. Estimates are always labelled as estimates.

export function DashboardMetrics({ metrics, currency }: { metrics: Metrics; currency?: string | null }) {
  const stat = [
    {
      label: "Software spend identified",
      value: formatMoney(metrics.softwareSpendIdentified, currency),
      cls: "text-zinc-900",
      hint: "identified, not confirmed",
    },
    {
      label: "Est. recurring software spend / mo",
      value: `${formatMoney(metrics.estimatedRecurringMonthly, currency)} / mo`,
      cls: "text-emerald-700",
      hint: "estimated",
    },
    {
      label: "Est. recurring software spend / yr",
      value: `${formatMoney(metrics.estimatedRecurringYearly, currency)} / yr`,
      cls: "text-emerald-700",
      hint: "estimated",
    },
    {
      label: "Merchants worth reviewing",
      value: metrics.merchantsWorthReviewing.toLocaleString(),
      cls: metrics.merchantsWorthReviewing > 0 ? "text-amber-700" : "text-zinc-900",
      hint: "worth a closer look",
    },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">At a glance</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Estimated figures from the transaction data — likely labels, not guarantees.
        </p>
      </div>
      <div className="px-5 py-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat.map((r) => (
            <div key={r.label} className="rounded-lg bg-zinc-50 px-4 py-3">
              <dt className="text-xs text-zinc-500">{r.label}</dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${r.cls}`}>{r.value}</dd>
              <dd className="mt-0.5 text-[11px] text-zinc-500">{r.hint}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
