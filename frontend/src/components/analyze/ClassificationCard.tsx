import type { ClassificationSummary } from "@/lib/classification/types";
import { categoryLabel } from "./classificationLabels";

export function ClassificationCard({ s }: { s: ClassificationSummary }) {
  const rows = [
    { key: "likelySaasCount" as const, label: categoryLabel.likely_saas, cls: "text-emerald-700" },
    { key: "likelySoftwareCount" as const, label: categoryLabel.likely_software, cls: "text-teal-600" },
    { key: "notSoftwareCount" as const, label: categoryLabel.not_software, cls: "text-zinc-700" },
    { key: "unknownCount" as const, label: categoryLabel.unknown, cls: "text-amber-700" },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-surface shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">Software classification</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          These are likely labels based on the transaction data, not guaranteed facts.
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
        <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 text-sm">
          <span className="text-zinc-600">
            <span className="font-semibold text-zinc-900">{s.totalClassified.toLocaleString()}</span>{" "}
            classified merchants
          </span>
          <span className="text-zinc-600">
            <span className="font-semibold text-amber-700">{s.needsReview.toLocaleString()}</span>{" "}
            need review
          </span>
        </div>
      </div>
    </div>
  );
}