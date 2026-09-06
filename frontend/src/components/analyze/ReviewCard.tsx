"use client";

import { useState } from "react";
import type { SpendReviewResult, ReviewStatus, SpendReview } from "@/lib/leak";
import { uniquePanelId } from "@/lib/merchant-detail";
import { formatMoney } from "@/lib/dashboard";
import { categoryLabel, categoryTone } from "./classificationLabels";
import {
  amountStabilityLabel,
  intervalLabel,
  statusLabel,
  statusTone,
} from "./recurringLabels";

const reviewStatusLabel: Record<ReviewStatus, string> = {
  strong_review: "Strong review",
  review: "Review",
  no_concern: "No concern",
  insufficient_evidence: "Insufficient evidence",
};

const reviewStatusTone: Record<ReviewStatus, string> = {
  strong_review: "bg-amber-50 text-amber-700",
  review: "bg-amber-50 text-amber-700",
  no_concern: "bg-zinc-100 text-zinc-600",
  insufficient_evidence: "bg-zinc-100 text-zinc-600",
};

const TOP_REVIEWS = 6;

export function ReviewCard({ result, currency }: { result: SpendReviewResult; currency?: string | null }) {
  const s = result.summary;
  const blocked = result.dataQuality === "blocked";
  const prioritized = result.reviews.filter(
    (r) => r.status === "review" || r.status === "strong_review",
  );
  const top = result.reviews.slice(0, TOP_REVIEWS);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">Software spend worth reviewing</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Recurring software spend that may be worth a closer look — not confirmed waste.
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
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-zinc-50 px-4 py-3">
                <dt className="text-xs text-zinc-500">Strong review signals</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-amber-700">
                  {s.strongReviewCount}
                </dd>
              </div>
              <div className="rounded-lg bg-zinc-50 px-4 py-3">
                <dt className="text-xs text-zinc-500">Additional reviews</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
                  {s.reviewCount}
                </dd>
              </div>
              <div className="rounded-lg bg-zinc-50 px-4 py-3">
                <dt className="text-xs text-zinc-500">Est. recurring spend to review / mo</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
                  {formatMoney(s.estimatedMonthlyReviewSpend, currency)}
                </dd>
              </div>
              <div className="rounded-lg bg-zinc-50 px-4 py-3">
                <dt className="text-xs text-zinc-500">Est. recurring spend to review / yr</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
                  {formatMoney(s.estimatedYearlyReviewSpend, currency)}
                </dd>
              </div>
            </dl>

            {top.length === 0 ? (
              <p className="mt-4 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                No recurring software spend needs review yet. Sasscout did not find enough
                evidence of recurring software payments in this dataset.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-zinc-100">
                {top.map((r) => (
                  <ReviewRow key={r.merchantKey} r={r} currency={currency} />
                ))}
              </ul>
            )}

            {prioritized.length > TOP_REVIEWS && (
              <p className="mt-3 text-xs text-zinc-500">
                +{prioritized.length - TOP_REVIEWS} more software merchants worth reviewing.
              </p>
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

function ReviewRow({ r, currency }: { r: SpendReview; currency?: string | null }) {
  const [open, setOpen] = useState(false);
  const rec = r.recurring;
  const panelId = uniquePanelId("review-evidence", r.merchantKey);

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
            <span className="truncate">{r.merchantName}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${reviewStatusTone[r.status]}`}
            >
              {reviewStatusLabel[r.status]}
            </span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${categoryTone[r.classification.category]}`}>
              {categoryLabel[r.classification.category]}
            </span>
            {rec &&
              rec.status !== "insufficient_data" &&
              rec.status !== "not_recurring" &&
              rec.interval &&
              rec.interval !== "irregular" && (
                <span className={`rounded-full px-2 py-0.5 font-semibold ${statusTone[rec.status]}`}>
                  {statusLabel[rec.status]} · {intervalLabel[rec.interval as "weekly" | "monthly" | "quarterly" | "annual"]}
                </span>
              )}
            {rec && rec.amountProfile && rec.amountProfile !== "insufficient_evidence" && (
              <span>{amountStabilityLabel[rec.amountProfile]}</span>
            )}
            {rec && rec.transactionCount > 0 && <span>· {rec.transactionCount} payments</span>}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
          {r.estimatedMonthlySpend !== null ? `${formatMoney(r.estimatedMonthlySpend, currency)}/mo` : "—"}
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={`Evidence for ${r.merchantName}`}
          className="mt-2 space-y-3 rounded-lg bg-zinc-50 px-4 py-3"
        >
          {r.recurring && r.recurring.evidence.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-zinc-500">Recurring pattern evidence</p>
              <ul className="mt-1 space-y-1">
                {r.recurring.evidence.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                    <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
                    {e.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {reviewFacts(r, currency).length > 0 && (
            <section>
              <p className="text-xs font-semibold text-zinc-500">Recurring pattern details</p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
                {reviewFacts(r, currency).map((fact, i) => (
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
            {r.reasons.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-600">No evidence recorded.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {r.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                    <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
                    {reason.message}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {r.estimatedMonthlySpend !== null && (
            <p className="text-xs text-zinc-500">
              Estimated {formatMoney(r.estimatedMonthlySpend, currency)}/month
              {r.estimatedYearlySpend !== null ? ` · ${formatMoney(r.estimatedYearlySpend, currency)}/year` : ""}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

// Counted, observational recurring-pattern facts. Only meaningful values shown.
function reviewFacts(r: SpendReview, currency?: string | null): string[] {
  const rec = r.recurring;
  if (!rec) return [];
  const facts: string[] = [];
  if (rec.transactionCount > 0) {
    facts.push(`${rec.transactionCount} payment${rec.transactionCount === 1 ? "" : "s"} observed.`);
  }
  if (rec.amountProfile && rec.amountProfile !== "insufficient_evidence") {
    facts.push(`Payments are ${amountStabilityLabel[rec.amountProfile].toLowerCase()} in amount.`);
  }
  if (rec.intervalConsistency > 0 && rec.intervalConsistency < 1) {
    facts.push(`Interval consistency ${Math.round(rec.intervalConsistency * 100)}%.`);
  }
  if (rec.patternSpanMonths > 0) {
    facts.push(`Pattern spans approximately ${rec.patternSpanMonths} month${rec.patternSpanMonths === 1 ? "" : "s"}.`);
  }
  if (rec.gapCount > 0) {
    facts.push(`${rec.gapCount} payment gap${rec.gapCount === 1 ? "" : "s"} detected.`);
  }
  if (rec.priceChange) {
    facts.push(`A price change was detected from ${formatMoney(rec.priceChange.from, currency)} to ${formatMoney(rec.priceChange.to, currency)}.`);
  }
  return facts;
}
