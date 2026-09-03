"use client";

import type { MerchantDetail } from "@/lib/merchant-detail";
import { deriveInvestigation } from "@/lib/merchant-detail";
import { formatMoney } from "@/lib/dashboard";
import { categoryLabel } from "./classificationLabels";
import {
  amountStabilityLabel,
  intervalLabel,
  statusLabel,
  strengthLabel,
} from "./recurringLabels";

const REVIEW_STATUS_LABEL: Record<string, string> = {
  strong_review: "Strong review",
  review: "Review",
  no_concern: "No concern",
  insufficient_evidence: "Insufficient evidence",
};

const CATEGORY_TONE: Record<string, string> = {
  likely_saas: "bg-emerald-50 text-emerald-700",
  likely_software: "bg-teal-50 text-teal-700",
  not_software: "bg-zinc-100 text-zinc-600",
  unknown: "bg-amber-50 text-amber-700",
};

const INVESTIGATION_PRIORITY_LABEL: Record<string, string> = {
  high: "High investigation priority",
  medium: "Medium investigation priority",
  low: "Low investigation priority",
};

const PRIORITY_TONE: Record<string, string> = {
  high: "bg-amber-50 text-amber-700",
  medium: "bg-blue-50 text-blue-700",
  low: "bg-zinc-100 text-zinc-600",
};

// Render a dash for an unavailable value rather than fabricating $0.
function money(n: number | null | undefined): string {
  return formatMoney(n);
}

export function MerchantDetailPanel({ detail }: { detail: MerchantDetail }) {
  const { classification, recurring, softwareSpend, review } = detail;
  const d = detail;
  const investigation = deriveInvestigation(detail);

  return (
    <div className="space-y-3 text-sm">
      {/* Merchant identity */}
      <section aria-labelledby="detail-merchant">
        <h3 id="detail-merchant" className="text-xs font-semibold text-zinc-500">
          Merchant
        </h3>
        <p className="mt-1 font-medium text-zinc-900">{d.merchantName}</p>
        <p className="text-xs text-zinc-500">
          {d.rawDescriptorCount} raw descriptor{d.rawDescriptorCount === 1 ? "" : "s"}
          {d.rawDescriptors.length > 0 ? ` · e.g. ${d.rawDescriptors.join(", ")}` : ""}
        </p>
      </section>

      {/* Investigation guidance */}
      <section aria-labelledby="detail-investigation" className="rounded-lg bg-zinc-50 px-3 py-3">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500" id="detail-investigation">
            Investigation
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_TONE[investigation.priority]}`}
          >
            {INVESTIGATION_PRIORITY_LABEL[investigation.priority]}
          </span>
        </p>
        <p className="mt-1 text-sm text-zinc-700">{investigation.summary}</p>
        {investigation.actions.length > 0 && (
          <ol className="mt-2 space-y-2" aria-label="Suggested next steps">
            {investigation.actions.map((action) => (
              <li key={action.id} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
                <div>
                  <p className="text-sm font-medium text-zinc-900">{action.label}</p>
                  <p className="text-xs text-zinc-500">{action.explanation}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        {investigation.caveats.map((c, i) => (
          <p key={`c${i}`} className="mt-2 text-xs text-zinc-500">
            {c}
          </p>
        ))}
      </section>

      {/* Classification */}
      <section aria-labelledby="detail-classification">
        <h3 id="detail-classification" className="text-xs font-semibold text-zinc-500">
          Classification
        </h3>
        <p className="mt-1 flex items-center gap-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${CATEGORY_TONE[classification.category]}`}>
            {categoryLabel[classification.category]}
          </span>
          <span className="text-xs text-zinc-500">{classification.confidence} confidence</span>
        </p>
        {classificationEvidenceList(d)}
      </section>

      {/* Recurring pattern */}
      <section aria-labelledby="detail-recurring">
        <h3 id="detail-recurring" className="text-xs font-semibold text-zinc-500">
          Recurring pattern
        </h3>
        <RecurringSection recurring={recurring} />
      </section>

      {/* Software spend */}
      <section aria-labelledby="detail-spend">
        <h3 id="detail-spend" className="text-xs font-semibold text-zinc-500">
          Software spend
        </h3>
        <ul className="mt-1 space-y-1 text-sm text-zinc-600">
          <li>
            Total historical spend{" "}
            <span className="font-medium text-zinc-900">{money(softwareSpend.totalSpend)}</span>
          </li>
          <li>
            Estimated recurring spend{" "}
            <span className="font-medium text-zinc-900">
              {money(softwareSpend.estimatedMonthlySpend)}/month
            </span>
          </li>
          <li>
            Estimated recurring spend{" "}
            <span className="font-medium text-zinc-900">
              {money(softwareSpend.estimatedYearlySpend)}/year
            </span>
          </li>
        </ul>
        <p className="mt-1 text-xs text-zinc-500">
          Software spend figures are estimates, not confirmed savings.
        </p>
      </section>

      {/* Review */}
      <section aria-labelledby="detail-review">
        <h3 id="detail-review" className="text-xs font-semibold text-zinc-500">
          Review
        </h3>
        <ReviewSection d={d} review={review} />
      </section>
    </div>
  );
}

function classificationEvidenceList(d: MerchantDetail) {
  if (d.classificationEvidence.length === 0) {
    return <p className="mt-1 text-sm text-zinc-500">No classification evidence was recorded.</p>;
  }
  return (
    <ul className="mt-1 space-y-1">
      {d.classificationEvidence.map((e, i) => (
        <li key={`ce${i}`} className="flex items-start gap-2 text-sm text-zinc-600">
          <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
          {e.message}
        </li>
      ))}
    </ul>
  );
}

function RecurringSection({
  recurring,
}: {
  recurring: MerchantDetail["recurring"];
}) {
  if (!recurring.status) {
    return (
      <p className="mt-1 text-sm text-zinc-500">
        No recurring pattern was identified for this merchant.
      </p>
    );
  }

  const facts: string[] = [];
  if (recurring.interval && recurring.interval !== "irregular") {
    facts.push(`Interval: ${intervalLabel[recurring.interval].toLowerCase()}`);
  }
  if (recurring.paymentCount !== null) {
    facts.push(`${recurring.paymentCount} payment${recurring.paymentCount === 1 ? "" : "s"} observed`);
  }
  if (recurring.typicalAmount !== null) {
    facts.push(`Typical amount ${money(recurring.typicalAmount)}`);
  }
  if (recurring.amountProfile && recurring.amountProfile !== "insufficient_evidence") {
    facts.push(`Payments are ${amountStabilityLabel[recurring.amountProfile].toLowerCase()} in amount`);
  }
  if (recurring.intervalConsistency !== null && recurring.intervalConsistency > 0) {
    facts.push(
      `Interval consistency ${Math.round(recurring.intervalConsistency * 100)}%`,
    );
  }
  if (recurring.patternSpanMonths !== null && recurring.patternSpanMonths > 0) {
    facts.push(
      `Pattern spans approximately ${recurring.patternSpanMonths} month${recurring.patternSpanMonths === 1 ? "" : "s"}`,
    );
  }
  if (recurring.gapCount !== null && recurring.gapCount > 0) {
    facts.push(`${recurring.gapCount} payment gap${recurring.gapCount === 1 ? "" : "s"} detected`);
  }

  return (
    <div className="mt-1">
      <p className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        <span className="font-medium text-zinc-900">{statusLabel[recurring.status]}</span>
        {recurring.confidence ? (
          <span className="text-zinc-500">({recurring.confidence} confidence)</span>
        ) : null}
        {recurring.strength ? (
          <span className="text-zinc-500">· {strengthLabel[recurring.strength]}</span>
        ) : null}
      </p>
      {facts.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
          {facts.map((f, i) => (
            <li key={`rf${i}`} className="flex items-start gap-1.5">
              <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
              {f}
            </li>
          ))}
        </ul>
      )}
      {recurring.priceChange && (
        <p className="mt-1 text-sm text-zinc-600">
          A price change was detected from {money(recurring.priceChange.from)} to{" "}
          {money(recurring.priceChange.to)}.
        </p>
      )}
      {recurring.evidence.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-500">No recurring evidence was recorded.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {recurring.evidence.map((e, i) => (
            <li key={`re${i}`} className="flex items-start gap-2 text-sm text-zinc-600">
              <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
              {e.message}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-zinc-500">
        Recurring patterns are evidence-based, not proof of an active subscription.
      </p>
    </div>
  );
}

function ReviewSection({
  d,
  review,
}: {
  d: MerchantDetail;
  review: MerchantDetail["review"];
}) {
  if (!review.status) {
    return (
      <p className="mt-1 text-sm text-zinc-500">
        {d.softwareSpend.status === "uncertain"
          ? "Review is unavailable because this merchant is not confirmed software."
          : "No review was recorded for this merchant."}
      </p>
    );
  }
  return (
    <div className="mt-1">
      <p className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        <span className="font-medium text-zinc-900">{REVIEW_STATUS_LABEL[review.status]}</span>
        {review.confidence ? (
          <span className="text-zinc-500">({review.confidence} confidence)</span>
        ) : null}
        {review.score !== null && <span className="text-zinc-500">· review signal {review.score}</span>}
      </p>
      {review.reasons.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-500">No specific review reason was recorded.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {review.reasons.map((reason, i) => (
            <li key={`rv${i}`} className="flex items-start gap-2 text-sm text-zinc-600">
              <span aria-hidden="true" className="mt-0.5 text-zinc-500">•</span>
              {reason.message}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-zinc-500">
        Review is a prioritization signal, not proof that spend may be reduced. Nothing is confirmed
        until you check the merchant yourself.
      </p>
    </div>
  );
}