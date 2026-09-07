"use client";

import { useMemo, useState } from "react";
import type { ReviewQueueFilter, ReviewQueueItem, ReviewQueueSort, ReviewQueueCounts } from "@/lib/dashboard";
import { filterAndSortReviews, formatMoney, countReviewQueue } from "@/lib/dashboard";
import { categoryLabel, categoryTone } from "./classificationLabels";
import {
  amountStabilityLabel,
  intervalLabel,
  statusLabel,
  statusTone,
  strengthLabel,
} from "./recurringLabels";
import { uniquePanelId } from "@/lib/merchant-detail";

const REVIEW_STATUS_LABEL: Record<ReviewQueueItem["reviewStatus"], string> = {
  strong_review: "Strong review",
  review: "Review",
  no_concern: "No concern",
  insufficient_evidence: "Insufficient evidence",
};

const REVIEW_STATUS_TONE: Record<ReviewQueueItem["reviewStatus"], string> = {
  strong_review: "bg-amber-50 text-amber-700",
  review: "bg-amber-50 text-amber-700",
  no_concern: "bg-zinc-100 text-zinc-600",
  insufficient_evidence: "bg-zinc-100 text-zinc-600",
};

const FILTERS: { value: ReviewQueueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "actionable", label: "Actionable" },
  { value: "strong_review", label: "Strong review" },
  { value: "review", label: "Review" },
  { value: "insufficient_evidence", label: "Insufficient evidence" },
];

const SORTS: { value: ReviewQueueSort; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "monthly_desc", label: "Highest est. monthly" },
  { value: "score_desc", label: "Highest review signal" },
  { value: "name_asc", label: "Merchant name" },
];

function chipCount(value: ReviewQueueFilter, counts: ReviewQueueCounts): number {
  switch (value) {
    case "all":
      return counts.all;
    case "actionable":
      return counts.actionable;
    case "strong_review":
      return counts.strong_review;
    case "review":
      return counts.review;
    case "insufficient_evidence":
      return counts.insufficient_evidence;
  }
}

// The primary actionable section. Built entirely from the existing review
// output (Step 10). Filtering/sorting is presentation-only; nothing is
// recomputed and the source data is never mutated.
export function ReviewQueue({
  reviews,
  blocked,
  strongReviewCount,
  reviewCount,
  onInspect,
  currency,
}: {
  reviews: ReviewQueueItem[];
  blocked: boolean;
  strongReviewCount: number;
  reviewCount: number;
  onInspect?: (merchantKey: string) => void;
  currency?: string | null;
}) {
  const [filter, setFilter] = useState<ReviewQueueFilter>("all");
  const [sort, setSort] = useState<ReviewQueueSort>("priority");

  const visible = useMemo(() => filterAndSortReviews(reviews, filter, sort), [reviews, filter, sort]);
  const showFilter = reviews.length > 1;
  const counts = useMemo(() => countReviewQueue(reviews), [reviews]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-surface shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">Review queue</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Software merchants worth a closer look — worth reviewing, not confirmed waste.
        </p>
      </div>

      <div className="px-5 py-4">
        {blocked ? (
          <p className="rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            Review unavailable. The transaction data needs attention before Sasscout can
            confidently identify recurring software spend.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">
                {strongReviewCount} strong · {reviewCount} to review
              </span>
              <span className="text-zinc-300" aria-hidden="true">|</span>
              {showFilter && (
                <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter review queue">
                  {FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFilter(f.value)}
                      aria-pressed={filter === f.value}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        filter === f.value
                          ? "bg-ink text-canvas"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      {f.label}
                      <span className="ml-1 font-normal opacity-70">({chipCount(f.value, counts)})</span>
                    </button>
                  ))}
                </div>
              )}
              <label className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
                <span className="sr-only">Sort review queue</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ReviewQueueSort)}
                  className="rounded-lg border border-zinc-200 bg-surface px-2 py-1 text-xs text-zinc-700"
                >
                  {SORTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {visible.length === 0 ? (
              reviews.length === 0 ? (
                <p className="rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                  No software merchants are flagged for review. That means nothing stood out from
                  the data — not that there is nothing worth checking.
                </p>
              ) : (
                <p className="rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                  No merchants match this filter.
                </p>
              )
            ) : (
              <ul className="divide-y divide-zinc-100">
                {visible.map((item) => (
                  <ReviewRow key={item.key} item={item} onInspect={onInspect} currency={currency} />
                ))}
              </ul>
            )}

            <p className="mt-4 rounded-lg bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
              Estimated recurring spend is an estimate tied to recurring software merchants, not a
              confirmed saving and not proof that a subscription is unused. Nothing has been
              uploaded — all analysis stays in your browser.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ReviewRow({
  item,
  onInspect,
  currency,
}: {
  item: ReviewQueueItem;
  onInspect?: (merchantKey: string) => void;
  currency?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rec = item.recurringStatus;
  const panelId = uniquePanelId("review-evidence", item.key);

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
            <span className="truncate">{item.name}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${REVIEW_STATUS_TONE[item.reviewStatus]}`}
            >
              {REVIEW_STATUS_LABEL[item.reviewStatus]}
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${categoryTone[item.category]}`}>
              {categoryLabel[item.category]}
            </span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="capitalize">{item.reviewConfidence} confidence</span>
            {rec && rec !== "insufficient_data" && rec !== "not_recurring" && (
              <span className={`rounded-full px-2 py-0.5 font-semibold ${statusTone[rec]}`}>
                {statusLabel[rec]}
                {item.recurringInterval && item.recurringInterval !== "irregular"
                  ? ` · ${intervalLabel[item.recurringInterval]}`
                  : ""}
              </span>
            )}
            {item.amountProfile && item.amountProfile !== "insufficient_evidence" && (
              <span>{amountStabilityLabel[item.amountProfile]}</span>
            )}
            {item.recurringStrength && item.recurringStrength !== "insufficient" && (
              <span>{strengthLabel[item.recurringStrength]}</span>
            )}
            {item.transactionCount > 0 && <span>· {item.transactionCount} payments</span>}
            {item.typicalAmount !== null && <span>· typical {formatMoney(item.typicalAmount, currency)}</span>}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
          {item.estimatedMonthlySpend !== null ? `${formatMoney(item.estimatedMonthlySpend, currency)}/mo` : "—"}
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={`Evidence for ${item.name}`}
          className="mt-2 space-y-3 rounded-lg bg-zinc-50 px-4 py-3"
        >
          {item.recurringEvidence.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-zinc-500">Recurring pattern evidence</p>
              <ul className="mt-1 space-y-1">
                {item.recurringEvidence.map((msg, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                    <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
                    {msg}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recurringFacts(item, currency).length > 0 && (
            <section>
              <p className="text-xs font-semibold text-zinc-500">Recurring pattern details</p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
                {recurringFacts(item, currency).map((fact, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
                    {fact}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <p className="text-xs font-semibold text-zinc-500">Why is this worth reviewing?</p>
            {item.reasons.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-600">No specific reason was recorded.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {item.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                    <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
                    {reason.message}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {item.estimatedMonthlySpend !== null && (
            <p className="text-xs text-zinc-500">
              Estimated {formatMoney(item.estimatedMonthlySpend, currency)}/month
              {item.estimatedYearlySpend !== null
                ? ` · ${formatMoney(item.estimatedYearlySpend, currency)}/year`
                : ""}
            </p>
          )}
          {item.reviewStatus === "insufficient_evidence" && (
            <p className="text-xs text-zinc-500">
              There isn&apos;t enough evidence to flag this confidently — it is a gap, not a confirmed problem.
            </p>
          )}
          {onInspect && (
            <p className="pt-1">
              <button
                type="button"
                onClick={() => onInspect(item.key)}
                className="rounded-md border border-zinc-200 bg-surface px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {item.reviewStatus === "review" || item.reviewStatus === "strong_review"
                  ? "View investigation"
                  : "View details"}
              </button>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

// Counted recurring-pattern facts shown next to the review reasons. Only
// meaningful, non-empty values are included; wording is observational.
function recurringFacts(item: ReviewQueueItem, currency?: string | null): string[] {
  const facts: string[] = [];
  if (item.transactionCount > 0) {
    facts.push(`${item.transactionCount} payment${item.transactionCount === 1 ? "" : "s"} observed.`);
  }
  if (item.amountProfile && item.amountProfile !== "insufficient_evidence") {
    facts.push(`Payments are ${amountStabilityLabel[item.amountProfile].toLowerCase()} in amount.`);
  }
  if (item.intervalConsistency !== null && item.intervalConsistency > 0 && item.intervalConsistency < 1) {
    facts.push(`Interval consistency ${Math.round(item.intervalConsistency * 100)}%.`);
  }
  if (item.patternSpanMonths !== null && item.patternSpanMonths > 0) {
    facts.push(`Pattern spans approximately ${item.patternSpanMonths} month${item.patternSpanMonths === 1 ? "" : "s"}.`);
  }
  if (item.gapCount !== null && item.gapCount > 0) {
    facts.push(`${item.gapCount} payment gap${item.gapCount === 1 ? "" : "s"} detected.`);
  }
  if (item.priceChange) {
    facts.push(`A price change was detected from ${formatMoney(item.priceChange.from, currency)} to ${formatMoney(item.priceChange.to, currency)}.`);
  }
  return facts;
}
