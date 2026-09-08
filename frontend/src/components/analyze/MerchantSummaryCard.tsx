import { useState } from "react";
import type { ClassifiedMerchant } from "@/lib/classification";
import type { RecurringPattern } from "@/lib/recurring/types";
import { categoryLabel, categoryTone, confidenceTone as classificationConfidenceTone } from "./classificationLabels";
import { confidenceTone, intervalLabel, statusLabel, statusTone } from "./recurringLabels";
import { uniquePanelId } from "@/lib/merchant-detail";

const TOP_MERCHANTS = 6;

export function MerchantSummaryCard({
  merchants,
  unresolvedCount,
  recurringByKey,
}: {
  merchants: ClassifiedMerchant[];
  unresolvedCount: number;
  recurringByKey: ReadonlyMap<string, RecurringPattern>;
}) {
  const top = merchants.slice(0, TOP_MERCHANTS);

  return (
    <div className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">Merchants identified</h2>
        <span className="text-sm text-zinc-500">
          <span className="font-semibold text-zinc-900">{merchants.length}</span> merchant
          identities · <span className="font-semibold text-zinc-900">{unresolvedCount}</span>{" "}
          unresolved
        </span>
      </div>

      <div className="px-5 py-4">
        {top.length === 0 ? (
          <p className="text-sm text-zinc-500">No merchant identities were resolved.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {top.map((m) => (
              <MerchantRow key={m.normalizedKey} m={m} recurring={recurringByKey.get(m.normalizedKey) ?? null} />
            ))}
          </ul>
        )}
        {merchants.length > TOP_MERCHANTS && (
          <p className="mt-3 text-xs text-zinc-500">
            +{merchants.length - TOP_MERCHANTS} more merchant identities.
          </p>
        )}
      </div>
    </div>
  );
}

function MerchantRow({ m, recurring }: { m: ClassifiedMerchant; recurring: RecurringPattern | null }) {
  const [open, setOpen] = useState(false);
  const c = m.classification;
  const r = recurring;
  const panelId = uniquePanelId("merchant-summary", m.normalizedKey);

  return (
    <li className="py-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
            <span className="truncate">{m.canonicalName}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${categoryTone[c.category]}`}>
              {categoryLabel[c.category]}
            </span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="truncate" title={m.distinctRawDescriptions.join(" · ")}>
              {m.transactionCount}{" "}
              txn{m.transactionCount === 1 ? "" : "s"}
              {m.firstSeen && m.lastSeen ? ` · ${m.firstSeen} → ${m.lastSeen}` : ""}
            </span>
            {r && (
              <span className={`rounded-full px-2 py-0.5 font-semibold ${statusTone[r.status]}`}>
                {statusLabel[r.status]}
                {r.status !== "insufficient_data" && r.status !== "not_recurring" && r.interval
                  ? ` · ${intervalLabel[r.interval as "weekly" | "monthly" | "quarterly" | "annual"]}`
                  : ""}
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
          {m.transactionCount}
        </span>
      </button>
      {open && (
        <div id={panelId} role="region" aria-label={`Evidence for ${m.canonicalName}`} className="mt-2 space-y-3 rounded-lg bg-zinc-50 px-4 py-3">
          <section>
            <p className={`text-xs font-semibold ${classificationConfidenceTone[c.confidence]}`}>
              {categoryLabel[c.category]} · {c.confidence} confidence
            </p>
            {c.evidence.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-600">No evidence recorded.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {c.evidence.map((e, i) => (
                  <li key={`c-${i}`} className="flex items-start gap-2 text-sm text-zinc-600">
                    <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
                    {e.message}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {r && (
            <section className="border-t border-zinc-200 pt-3">
              <p className={`text-xs font-semibold ${confidenceTone[r.confidence]}`}>
                {statusLabel[r.status]}
                {r.status !== "insufficient_data" && r.status !== "not_recurring" && r.interval
                  ? ` · ${intervalLabel[r.interval as "weekly" | "monthly" | "quarterly" | "annual"]}`
                  : ""}{" "}
                · {r.confidence} confidence
              </p>
              {r.typicalAmount !== null && (
                <p className="mt-1 text-sm text-zinc-600">
                  Typical amount: ${r.typicalAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </p>
              )}
              {r.evidence.length === 0 ? (
                <p className="mt-1 text-sm text-zinc-600">No evidence recorded.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {r.evidence.map((e, i) => (
                    <li key={`r-${i}`} className="flex items-start gap-2 text-sm text-zinc-600">
                      <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
                      {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </li>
  );
}