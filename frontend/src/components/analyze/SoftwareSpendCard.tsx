import type { SoftwareSpendResult } from "@/lib/software";
import { formatMoney } from "@/lib/dashboard";

export function SoftwareSpendCard({ result, currency }: { result: SoftwareSpendResult; currency?: string | null }) {
  const s = result.summary;

  const stat = [
    {
      label: "Total software spend",
      value: formatMoney(s.totalSoftwareSpend, currency),
      cls: "text-zinc-900",
    },
    {
      label: "Est. monthly recurring",
      value: formatMoney(s.estimatedMonthlySpend, currency),
      cls: "text-emerald-700",
    },
    {
      label: "Est. yearly recurring",
      value: formatMoney(s.estimatedYearlySpend, currency),
      cls: "text-emerald-700",
    },
    {
      label: "Software merchants",
      value: s.softwareMerchantCount.toLocaleString(),
      cls: "text-zinc-900",
    },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">Software spend</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Estimated recurring software spend, not guaranteed subscriptions.
        </p>
      </div>

      <div className="px-5 py-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat.map((r) => (
            <div key={r.label} className="rounded-lg bg-zinc-50 px-4 py-3">
              <dt className="text-xs text-zinc-500">{r.label}</dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${r.cls}`}>{r.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 overflow-x-auto" tabIndex={0}>
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th scope="col" className="rounded-l-lg px-4 py-2.5 font-medium">Merchant</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Total spend</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Est. monthly</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {s.topSoftwareByTotal.map((m) => (
                <tr key={m.normalizedKey}>
                  <td className="px-4 py-2.5 text-zinc-900">{m.displayName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{formatMoney(m.totalSpend, currency)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{formatMoney(m.estimatedMonthlySpend, currency)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{m.transactionCount}</td>
                </tr>
              ))}
              {s.topSoftwareByTotal.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                    No software merchants detected.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 rounded-lg bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
          Monthly and yearly figures are estimates derived from recurring labels; one-off purchases
          and uncertain merchants are excluded. Nothing has been uploaded — all analysis stays in your
          browser.
        </p>
      </div>
    </div>
  );
}
