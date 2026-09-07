"use client";

import { useState } from "react";
import type { DashboardMerchantRow } from "@/lib/dashboard";
import { formatMoney } from "@/lib/dashboard";
import { categoryLabel, categoryTone, confidenceTone as categoryConfidenceTone } from "./classificationLabels";
import { amountStabilityLabel, intervalLabel, statusLabel, statusTone } from "./recurringLabels";
import { uniquePanelId } from "@/lib/merchant-detail";
import { StoneBars } from "@/components/ui/StoneBars";

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
  currency,
}: {
  rows: DashboardMerchantRow[];
  onInspect?: (merchantKey: string) => void;
  currency?: string | null;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const ordered = [...rows].sort((a, b) => (b.totalSpend ?? 0) - (a.totalSpend ?? 0));
  const topSpend = ordered
    .filter((m) => m.estimatedMonthlySpend != null && m.estimatedMonthlySpend > 0)
    .slice(0, 8);

  return (
    <div className="mt-8 overflow-hidden border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <p className="font-mono text-[11px] text-ink-3 lowercase">software / saas merchant breakdown</p>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Software / SaaS Breakdown</h2>
          <span className="text-sm text-ink-2">
            <span className="font-semibold text-ink">{rows.length}</span> merchant identities
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-2">
          No merchant identities were identified in this data.
        </p>
      ) : (
        <div className="px-5 py-4">
          {topSpend.length > 0 && (
            <div className="mb-6">
              <p className="mb-3 font-mono text-[11px] text-ink-3 lowercase">est. monthly by merchant</p>
              <StoneBars
                items={topSpend.map((m) => ({
                  label: m.name,
                  value: m.estimatedMonthlySpend!,
                }))}
              />
            </div>
          )}
          <div className="overflow-x-auto" tabIndex={0}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line font-mono text-[11px] text-ink-3">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium lowercase">merchant</th>
                  <th scope="col" className="px-5 py-3 font-medium lowercase">category</th>
                  <th scope="col" className="px-5 py-3 font-medium lowercase">confidence</th>
                  <th scope="col" className="px-5 py-3 font-medium lowercase">recurring</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium lowercase">payments</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium lowercase">typical</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium lowercase">est. monthly</th>
                  <th scope="col" className="px-5 py-3 font-medium lowercase">review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
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
                      currency={currency}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
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
  currency,
}: {
  m: DashboardMerchantRow;
  expandable: boolean;
  open: boolean;
  onToggle: () => void;
  onInspect?: (merchantKey: string) => void;
  currency?: string | null;
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
        <td className="px-5 py-3 text-right tabular-nums text-zinc-700">{formatMoney(m.typicalAmount, currency)}</td>
        <td className="px-5 py-3 text-right tabular-nums text-zinc-700">{formatMoney(m.estimatedMonthlySpend, currency)}</td>
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
        <tr id={evidenceId} role="region" aria-label={`Recurring evidence for ${m.name}`} className="bg-surface-muted">
          <td colSpan={TABLE_COLS} className="px-5 py-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink-3">
                  Why Sasscout believes this repeats
                  {m.recurringStrength ? (
                    <span className={`ml-1 font-medium ${STRENGTH_TONE[m.recurringStrength]}`}>
                      · {STRENGTH_LABEL[m.recurringStrength]}
                    </span>
                  ) : null}
                </p>
                <ul className="space-y-1">
                  {m.recurringEvidence.map((msg, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
                      <span aria-hidden="true" className="mt-0.5 text-ink-3">•</span>
                      {msg}
                    </li>
                  ))}
                </ul>
                {breakdownFacts(m, currency).length > 0 && (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
                    {breakdownFacts(m, currency).map((fact, i) => (
                      <li key={`f${i}`} className="flex items-start gap-1.5">
                        <span aria-hidden="true" className="mt-0.5 text-ink-3">•</span>
                        {fact}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-ink-3">
                  {m.transactionCount} payment{m.transactionCount === 1 ? "" : "s"} · typical{" "}
                  {formatMoney(m.typicalAmount, currency)}
                  {m.estimatedMonthlySpend !== null
                    ? ` · est. ${formatMoney(m.estimatedMonthlySpend, currency)}/month`
                    : ""}
                  {m.estimatedYearlySpend !== null
                    ? ` · ${formatMoney(m.estimatedYearlySpend, currency)}/year`
                    : ""}
                </p>
                <p className="text-xs text-ink-3">
                  Recurring patterns are evidence-based, not proof of an active subscription.
                </p>
                {onInspect && (
                  <p className="pt-1">
                    <button
                      type="button"
                      onClick={() => onInspect(m.normalizedKey)}
                      className="rounded border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
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
function breakdownFacts(m: DashboardMerchantRow, currency?: string | null): string[] {
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
    facts.push(`A price change was detected from ${formatMoney(m.priceChange.from, currency)} to ${formatMoney(m.priceChange.to, currency)}.`);
  }
  return facts;
}
