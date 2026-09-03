"use client";

import { useState } from "react";
import type { DashboardMerchantRow } from "@/lib/dashboard";
import { formatMoney } from "@/lib/dashboard";
import { categoryLabel, categoryTone, confidenceTone as categoryConfidenceTone } from "./classificationLabels";
import { amountStabilityLabel, intervalLabel, statusLabel, statusTone } from "./recurringLabels";
import { uniquePanelId } from "@/lib/merchant-detail";

const REVIEW_STATUS_LABEL: Record<string, string> = {
  strong_review: "Strong review",
  review: "Review",
  no_concern: "No concern",
  insufficient_evidence: "Insufficient evidence",
};

const STRENGTH_LABEL: Record<string, string> = {
  strong: "Strong pattern",
  moderate: "Moderate pattern",
  weak: "Weak pattern",
  insufficient: "Insufficient",
};

const STRENGTH_TONE: Record<string, string> = {
  strong: "text-emerald-700",
  moderate: "text-amber-700",
  weak: "text-zinc-500",
  insufficient: "text-zinc-500",
};

const TABLE_COLS = 8;

function isConcreteRecurring(m: DashboardMerchantRow): boolean {
  return (
    !!m.recurringStatus &&
    m.recurringStatus !== "insufficient_data" &&
    m.recurringStatus !== "not_recurring" &&
    !!m.recurringInterval &&
    m.recurringInterval !== "irregular"
  );
}

// Software/SaaS merchant breakdown. Driven by the existing classification and
// recurring outputs; category terminology is unchanged and "Unknown" is a
// legitimate state. An expandable "Why?" reveal shows the recurring evidence.
export function SoftwareBreakdown({
  rows,
  onInspect,
}: {
  rows: DashboardMerchantRow[];
  onInspect?: (merchantKey: string) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const ordered = [...rows].sort((a, b) => (b.totalSpend ?? 0) - (a.totalSpend ?? 0));

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">Software / SaaS merchant breakdown</h2>
        <span className="text-sm text-zinc-500">
          <span className="font-semibold text-zinc-900">{rows.length}</span> merchant identities
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">
          No merchant identities were identified in this data.
        </p>
      ) : (
        <div className="overflow-x-auto" tabIndex={0}>
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Merchant</th>
                <th scope="col" className="px-5 py-3 font-medium">Category</th>
                <th scope="col" className="px-5 py-3 font-medium">Confidence</th>
                <th scope="col" className="px-5 py-3 font-medium">Recurring</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Payments</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Typical</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Est. monthly</th>
                <th scope="col" className="px-5 py-3 font-medium">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {ordered.map((m) => {
                const expandable = isConcreteRecurring(m) && m.recurringEvidence.length > 0;
                const open = openKey === m.normalizedKey;
                return (
                  <RecurringMerchantRow
                    key={m.normalizedKey}
                    m={m}
                    expandable={expandable}
                    open={open}
                    onToggle={() => setOpenKey(open ? null : m.normalizedKey)}
                    onInspect={onInspect}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecurringMerchantRow({
  m,
  expandable,
  open,
  onToggle,
  onInspect,
}: {
  m: DashboardMerchantRow;
  expandable: boolean;
  open: boolean;
  onToggle: () => void;
  onInspect?: (merchantKey: string) => void;
}) {
  const recurring = isConcreteRecurring(m);
  const evidenceId = uniquePanelId("rec-evidence", m.normalizedKey);
  return (
    <>
      <tr className="align-top">
        <td className="px-5 py-3 text-zinc-900">{m.name}</td>
        <td className="px-5 py-3">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${categoryTone[m.category]}`}>
            {categoryLabel[m.category]}
          </span>
        </td>
        <td className={`px-5 py-3 ${categoryConfidenceTone[m.classificationConfidence]}`}>
          {m.classificationConfidence}
        </td>
        <td className="px-5 py-3">
          {recurring ? (
            <div className="flex items-center gap-2">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[m.recurringStatus!]}`}>
                {statusLabel[m.recurringStatus!]}
                {m.recurringInterval && m.recurringInterval !== "irregular"
                  ? ` · ${intervalLabel[m.recurringInterval]}`
                  : ""}
              </span>
              {expandable && (
                <button
                  type="button"
                  onClick={onToggle}
                  aria-expanded={open}
                  aria-controls={evidenceId}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  {open ? "Hide why" : "Why?"}
                </button>
              )}
            </div>
          ) : (
            <span className="text-zinc-500">—</span>
          )}
        </td>
        <td className="px-5 py-3 text-right tabular-nums text-zinc-500">{m.transactionCount}</td>
        <td className="px-5 py-3 text-right tabular-nums text-zinc-700">{formatMoney(m.typicalAmount)}</td>
        <td className="px-5 py-3 text-right tabular-nums text-zinc-700">{formatMoney(m.estimatedMonthlySpend)}</td>
        <td className="px-5 py-3">
          {m.reviewStatus && m.reviewStatus !== "no_concern" ? (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                m.reviewStatus === "strong_review"
                  ? "bg-amber-50 text-amber-700"
                  : m.reviewStatus === "review"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {REVIEW_STATUS_LABEL[m.reviewStatus]}
            </span>
          ) : (
            <span className="text-zinc-500">—</span>
          )}
        </td>
      </tr>
      {open && (
        <tr id={evidenceId} role="region" aria-label={`Recurring evidence for ${m.name}`} className="bg-zinc-50">
          <td colSpan={TABLE_COLS} className="px-5 py-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500">
                Why Sasscout believes this repeats
                {m.recurringStrength ? (
                  <span className={`ml-1 font-medium ${STRENGTH_TONE[m.recurringStrength]}`}>
                    · {STRENGTH_LABEL[m.recurringStrength]}
                  </span>
                ) : null}
              </p>
              <ul className="space-y-1">
                {m.recurringEvidence.map((msg, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                    <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
                    {msg}
                  </li>
                ))}
              </ul>
              {breakdownFacts(m).length > 0 && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
                  {breakdownFacts(m).map((fact, i) => (
                    <li key={`f${i}`} className="flex items-start gap-1.5">
                      <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
                      {fact}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-zinc-500">
                {m.transactionCount} payment{m.transactionCount === 1 ? "" : "s"} · typical{" "}
                {formatMoney(m.typicalAmount)}
                {m.estimatedMonthlySpend !== null
                  ? ` · est. ${formatMoney(m.estimatedMonthlySpend)}/month`
                  : ""}
                {m.estimatedYearlySpend !== null
                  ? ` · ${formatMoney(m.estimatedYearlySpend)}/year`
                  : ""}
              </p>
              <p className="text-xs text-zinc-500">
                Recurring patterns are evidence-based, not proof of an active subscription.
              </p>
              {onInspect && (
                <p className="pt-1">
                  <button
                    type="button"
                    onClick={() => onInspect(m.normalizedKey)}
                    className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Investigate
                  </button>
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Counted, observational recurring-pattern facts for a breakdown row.
function breakdownFacts(m: DashboardMerchantRow): string[] {
  const facts: string[] = [];
  if (m.amountProfile && m.amountProfile !== "insufficient_evidence") {
    facts.push(`Payments are ${amountStabilityLabel[m.amountProfile].toLowerCase()} in amount.`);
  }
  if (m.intervalConsistency !== null && m.intervalConsistency > 0 && m.intervalConsistency < 1) {
    facts.push(`Interval consistency ${Math.round(m.intervalConsistency * 100)}%.`);
  }
  if (m.patternSpanMonths !== null && m.patternSpanMonths > 0) {
    facts.push(`Pattern spans approximately ${m.patternSpanMonths} month${m.patternSpanMonths === 1 ? "" : "s"}.`);
  }
  if (m.gapCount !== null && m.gapCount > 0) {
    facts.push(`${m.gapCount} payment gap${m.gapCount === 1 ? "" : "s"} detected.`);
  }
  if (m.priceChange) {
    facts.push(`A price change was detected from ${formatMoney(m.priceChange.from)} to ${formatMoney(m.priceChange.to)}.`);
  }
  return facts;
}
