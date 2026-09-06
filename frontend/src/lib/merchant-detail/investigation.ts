import type { MerchantDetail } from "./index";
import { formatMoney } from "../dashboard";

// STEP 19 — Merchant actionability & investigation layer.
//
// Pure, deterministic, presentation-only derivation. It turns the existing
// merchant drill-down into neutral investigation guidance. It does NOT compute
// a new risk score, does NOT touch SpendReview.score or ReviewStatus, and never
// duplicates the classification / recurring / software-spend / leak analyses —
// it only reads the persisted analysis output already carried in MerchantDetail.
//
// Every recommendation is framed as something to CHECK, never a claim that the
// merchant should be cancelled or that money is being wasted/saved.

export type InvestigationPriority = "high" | "medium" | "low";

export type InvestigationActionId =
  | "verify-underlying-merchant"
  | "confirm-merchant-identity"
  | "review-price-change"
  | "review-payment-gaps"
  | "verify-service-in-use"
  | "check-plan-matches"
  | "review-latest-charge"
  | "confirm-estimated-spend";

export type InvestigationAction = {
  id: InvestigationActionId;
  label: string;
  explanation: string;
  priority: InvestigationPriority;
};

export type MerchantInvestigation = {
  merchantKey: string;
  priority: InvestigationPriority;
  summary: string;
  actions: InvestigationAction[];
  caveats: string[];
};

// Long recurring history, used as one part of the "substantial history" signal.
const LONG_HISTORY_MONTHS = 6;

function isRecurringMerchant(d: MerchantDetail): boolean {
  return (
    d.recurring.status === "likely_recurring" ||
    d.recurring.status === "possibly_recurring"
  );
}

// A merchant with no review concern should not be presented as needing
// investigation. Keeps priority/actions neutral without implying cancellation.
function isNoConcern(d: MerchantDetail): boolean {
  return d.review.status === "no_concern";
}

function identityActions(d: MerchantDetail): InvestigationAction[] {
  if (isNoConcern(d)) return [];
  const unknown =
    d.softwareSpend.status !== "software" ||
    d.classification.category === "unknown";
  if (!unknown) return [];

  const ambiguous = d.classificationEvidence.some(
    (e) => e.type === "ambiguous_signal",
  );
  if (ambiguous) {
    return [
      {
        id: "verify-underlying-merchant",
        label: "Verify the underlying merchant",
        priority: "high",
        explanation:
          "This appears to be a payment processor or a merchant that also handles non-software spend. Confirm which merchant is actually being charged before investigating the recurring spend.",
      },
    ];
  }
  return [
    {
      id: "confirm-merchant-identity",
      label: "Confirm the merchant identity",
      priority: "high",
      explanation:
        "There is not enough evidence to confirm what this merchant is. Confirm the identity before drawing conclusions.",
    },
  ];
}

function recurringActions(d: MerchantDetail): InvestigationAction[] {
  if (isNoConcern(d)) return [];
  const rec = d.recurring;
  if (!isRecurringMerchant(d) || !rec) return [];

  const actions: InvestigationAction[] = [];

  if (rec.priceChange) {
    actions.push({
      id: "review-price-change",
      label: `Review the price change from ${formatMoney(rec.priceChange.from, d.currency)} to ${formatMoney(rec.priceChange.to, d.currency)}`,
      priority: "high",
      explanation:
        "Sasscout detected the recurring amount changed within the history. Review it against the expected billing amount — a price change is not a sign of a leak on its own.",
    });
  }

  if ((rec.gapCount ?? 0) > 0) {
    actions.push({
      id: "review-payment-gaps",
      label: "Review the payment gaps in the recurring history",
      priority: "medium",
      explanation:
        "Sasscout observed gaps where a payment was expected but not seen. Review the history for irregularity before drawing conclusions.",
    });
  }

  const meaningfulMonthly =
    d.softwareSpend.estimatedMonthlySpend !== null &&
    d.softwareSpend.estimatedMonthlySpend > 0;

  if (meaningfulMonthly && d.softwareSpend.status === "software") {
    actions.push({
      id: "verify-service-in-use",
      label: "Verify whether this service is still actively used",
      priority: "high",
      explanation: `Sasscout associated about ${formatMoney(d.softwareSpend.estimatedMonthlySpend, d.currency)}/month of recurring spend with this software merchant. Verify whether the service is still actively used rather than assuming either way.`,
    });
    actions.push({
      id: "check-plan-matches",
      label: "Check whether the current plan matches your needs",
      priority: "medium",
      explanation:
        "Confirm the current plan against what you actually need. Do not assume the pricing is wrong.",
    });
    actions.push({
      id: "review-latest-charge",
      label: "Review the latest charge against the expected recurring amount",
      priority: "medium",
      explanation:
        "Compare the most recent charge to the expected recurring amount so a mislabelled or changed charge is caught.",
    });
  }

  return actions;
}

function spendActions(d: MerchantDetail): InvestigationAction[] {
  if (isNoConcern(d)) return [];
  const est = d.softwareSpend.estimatedMonthlySpend;
  if (est === null || est === undefined || est <= 0) return [];
  return [
    {
      id: "confirm-estimated-spend",
      label: "Confirm the estimated recurring spend",
      priority: "low",
      explanation: `Sasscout estimated about ${formatMoney(est, d.currency)}/month of recurring spend from the observed pattern. Confirm this against the actual billing before acting on it.`,
    },
  ];
}

function summary(d: MerchantDetail): string {
  const rv = d.review.status;

  if (isNoConcern(d)) {
    return "No investigation is required based on the current evidence.";
  }
  if (rv === "strong_review") {
    return isSoftware(d)
      ? "A recurring software merchant ranked as a strong review signal. Investigate whether this software is worth its current recurring spend."
      : "A merchant ranked as a strong review signal. Confirm the merchant and evidence before acting.";
  }
  if (rv === "review") {
    return isSoftware(d)
      ? "A recurring software merchant worth a closer look. Verify what it is used for before drawing conclusions."
      : "A merchant worth a closer look. Confirm what it is before drawing conclusions.";
  }
  if (rv === "insufficient_evidence") {
    return "There is not enough evidence to flag this confidently. Verify the merchant identity and evidence before deciding anything.";
  }
  if (d.classification.category === "unknown" || d.softwareSpend.status !== "software") {
    return "This merchant is not confirmed as software. Confirm its identity and evidence before any further investigation.";
  }
  if (isRecurringMerchant(d)) {
    return "Recurring spend is associated with this merchant. Verify how it is used before drawing conclusions.";
  }
  return "Limited evidence is available for this merchant. Confirm identity and the available details before drawing conclusions.";
}

function isSoftware(d: MerchantDetail): boolean {
  return (
    d.softwareSpend.status === "software" && isRecurringMerchant(d)
  );
}

function caveats(d: MerchantDetail): string[] {
  if (isNoConcern(d)) {
    return [
      "Nothing here requires action. If the evidence changes, Sasscout will surface it.",
    ];
  }
  return [
    "This is neutral guidance to help you check the merchant — it is not proof that the subscription is unused or should be cancelled.",
    "Recurring patterns, estimates, and review signals are evidence-based guesses; confirm each with the actual charges.",
  ];
}

export function deriveInvestigation(d: MerchantDetail): MerchantInvestigation {
  const identity = identityActions(d);
  const recurring = recurringActions(d);
  const spend = spendActions(d);

  // Deterministic: identity verification first, then evidence, then spend.
  const actions = [...identity, ...recurring, ...spend].slice(0, 4);

  return {
    merchantKey: d.merchantKey,
    priority: resolvePriority(d, actions),
    summary: summary(d),
    actions,
    caveats: caveats(d),
  };
}

// Presentation-only priority. Read top-to-bottom so the product's own review
// signal drives the bucket, and combined recurring strength + history + spend
// can raise it. Never modifies any stored status or score.
function resolvePriority(
  d: MerchantDetail,
  actions: InvestigationAction[],
): InvestigationPriority {
  if (isNoConcern(d)) return "low";

  const rv = d.review.status;
  const rec = d.recurring;

  if (rv === "strong_review") return "high";
  if (rv === "insufficient_evidence") return "low";

  const longHistory = (rec?.patternSpanMonths ?? 0) >= LONG_HISTORY_MONTHS;
  const meaningful =
    d.softwareSpend.estimatedMonthlySpend !== null &&
    d.softwareSpend.estimatedMonthlySpend > 0;

  if (rv === "review") {
    if (rec?.strength === "strong" && longHistory && meaningful) return "high";
    return "medium";
  }

  if (isRecurringMerchant(d) && rec) {
    if (rec.strength === "strong" && longHistory && meaningful) return "high";
    if (rec.strength === "moderate") return "medium";
    if (rec.strength === "weak") return "low";
    return "medium";
  }

  // Not flagged and no recurring evidence. Identity verification still warrants
  // a step up; otherwise keep it low.
  if (
    actions.some(
      (a) =>
        a.id === "confirm-merchant-identity" ||
        a.id === "verify-underlying-merchant",
    )
  ) {
    return "medium";
  }
  return "low";
}