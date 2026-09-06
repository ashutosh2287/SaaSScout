import { describe, expect, it } from "vitest";
import { deriveInvestigation, deriveMerchantDetail } from "./index";
import type { MerchantDetail } from "./index";
import type { ReportMerchant } from "../report/types";

function baseDetail(overrides?: Partial<MerchantDetail>): MerchantDetail {
  const detail: MerchantDetail = {
    merchantKey: "adobe",
    merchantName: "Adobe",
    transactionCount: 6,
    rawDescriptorCount: 2,
    rawDescriptors: ["ADOBE CREATIVE CLOUD", "ADOBE CC"],
    currency: null,
    classification: {
      category: "likely_saas",
      confidence: "high",
      evidence: [{ type: "merchant_dictionary", message: "Known software vendor." }],
    },
    classificationEvidence: [
      { type: "merchant_dictionary", message: "Known software vendor." },
    ],
    recurring: {
      status: "likely_recurring",
      confidence: "high",
      strength: "strong",
      interval: "monthly",
      amountProfile: "highly_stable",
      intervalConsistency: 1,
      paymentCount: 6,
      typicalAmount: 1499,
      patternSpanMonths: 6,
      gapCount: 0,
      priceChange: null,
      evidence: [],
    },
    softwareSpend: {
      status: "software",
      totalSpend: 8994,
      estimatedMonthlySpend: 1499,
      estimatedYearlySpend: 17988,
    },
    review: {
      status: "strong_review",
      confidence: "high",
      score: 8,
      reasons: [{ type: "recurring_software", message: "Recurring software payments." }],
    },
    ...overrides,
  };
  return detail;
}

// Convenience to patch several recurring fields at once.
function withRecurring(
  d: MerchantDetail,
  rec: Partial<MerchantDetail["recurring"]>,
): MerchantDetail {
  return { ...d, recurring: { ...d.recurring, ...rec } };
}

function reviewStatus(d: MerchantDetail, status: MerchantDetail["review"]["status"]): MerchantDetail {
  return { ...d, review: { ...d.review, status } };
}

// Directive/claim forms only — a caveat that says "not proof it should be
// cancelled" is the compliant disclaiming language, not a cancellation claim.
const FORBIDDEN = [
  "cancel this",
  "cancel the subscription",
  "you are wasting",
  "you can save",
  "this subscription is confirmed",
  "is definitely unnecessary",
  "guaranteed saving",
];

describe("STEP 19 — investigation derivation", () => {
  it("1: strong_review merchant has high investigation priority", () => {
    const inv = deriveInvestigation(baseDetail());
    expect(inv.priority).toBe("high");
    expect(inv.actions.length).toBeGreaterThan(0);
  });

  it("2: review merchant has medium priority", () => {
    // Short history, so it stays medium rather than climbing to high.
    const d = withRecurring(reviewStatus(baseDetail(), "review"), { patternSpanMonths: 2 });
    expect(deriveInvestigation(d).priority).toBe("medium");
  });

  it("3: insufficient evidence has low priority with verification focus", () => {
    const d = reviewStatus(baseDetail(), "insufficient_evidence");
    const inv = deriveInvestigation(d);
    expect(inv.priority).toBe("low");
    expect(inv.summary.toLowerCase()).toContain("verify");
  });

  it("4: no_concern produces no investigation actions and neutral summary", () => {
    const d = reviewStatus(baseDetail(), "no_concern");
    const inv = deriveInvestigation(d);
    expect(inv.actions.length).toBe(0);
    expect(inv.summary.toLowerCase()).toContain("no investigation");
  });

  it("5: unknown merchant gets identity verification guidance", () => {
    const d = baseDetail({
      classification: { category: "unknown", confidence: "low", evidence: [] },
      classificationEvidence: [{ type: "generic_merchant", message: "Not enough evidence." }],
      softwareSpend: { status: "uncertain", totalSpend: 0, estimatedMonthlySpend: null, estimatedYearlySpend: null },
    });
    const inv = deriveInvestigation(d);
    expect(inv.actions.some((a) => a.id === "confirm-merchant-identity")).toBe(true);
  });

  it("6: processor/unresolved merchant gets underlying-merchant verification", () => {
    const d = baseDetail({
      classification: { category: "unknown", confidence: "medium", evidence: [] },
      classificationEvidence: [
        { type: "ambiguous_signal", message: "This is a payment processor; the underlying merchant couldn't be identified." },
      ],
      softwareSpend: { status: "uncertain", totalSpend: 0, estimatedMonthlySpend: null, estimatedYearlySpend: null },
    });
    const inv = deriveInvestigation(d);
    expect(inv.actions.some((a) => a.id === "verify-underlying-merchant")).toBe(true);
  });

  it("7: price change adds a review-the-price-change action", () => {
    const d = withRecurring(baseDetail(), { priceChange: { from: 1299, to: 1499 } });
    const inv = deriveInvestigation(d);
    const action = inv.actions.find((a) => a.id === "review-price-change");
    expect(action).toBeDefined();
    expect(action!.label).toContain("$1,299");
    expect(action!.label).toContain("$1,499");
    expect(action!.label.toLowerCase()).toContain("price change");
  });

  it("8: payment gaps add a gap investigation action", () => {
    const d = withRecurring(baseDetail(), { gapCount: 1 });
    const inv = deriveInvestigation(d);
    expect(inv.actions.some((a) => a.id === "review-payment-gaps")).toBe(true);
  });

  it("9: long-running recurring software gets an appropriate investigation", () => {
    const d = withRecurring(baseDetail(), { patternSpanMonths: 12 });
    const inv = deriveInvestigation(d);
    expect(inv.priority).toBe("high");
    expect(inv.actions.some((a) => a.id === "verify-service-in-use")).toBe(true);
    expect(inv.actions.some((a) => a.id === "check-plan-matches")).toBe(true);
  });

  it("10: weak recurring uses conservative wording and low priority", () => {
    const d = { ...withRecurring(baseDetail(), { strength: "weak" }), review: { ...baseDetail().review, status: null } };
    const inv = deriveInvestigation(d);
    expect(inv.priority).toBe("low");
    const text = allText(inv);
    expect(text.toLowerCase()).not.toContain("definitely");
    expect(inv.summary.toLowerCase()).toMatch(/verify|confirm|limited/);
  });

  it("11: null optional fields produce no fabricated values", () => {
    const d = baseDetail({
      softwareSpend: { status: "software", totalSpend: null, estimatedMonthlySpend: null, estimatedYearlySpend: null },
      recurring: { status: "likely_recurring", confidence: "high", strength: "strong", interval: "monthly", amountProfile: "highly_stable", intervalConsistency: 1, paymentCount: null, typicalAmount: null, patternSpanMonths: 0, gapCount: 0, priceChange: null, evidence: [] },
    });
    const inv = deriveInvestigation(d);
    expect(inv.actions.some((a) => a.id === "confirm-estimated-spend")).toBe(false);
    const text = allText(inv);
    expect(text).not.toMatch(/\$0(\.00)?/);
  });

  it("12: deterministic output for the same input", () => {
    const d = baseDetail();
    expect(deriveInvestigation(d)).toEqual(deriveInvestigation(d));
  });

  it("13: does not mutate the input detail", () => {
    const d = baseDetail();
    const before = JSON.stringify(d);
    deriveInvestigation(d);
    expect(JSON.stringify(d)).toBe(before);
  });

  it("14: saved-report derivation parity — same ReportMerchant yields same investigation", () => {
    const reportMerchant: ReportMerchant = {
      normalizedKey: "adobe",
      merchantName: "Adobe",
      transactionCount: 6,
      firstSeen: "2025-07-10",
      lastSeen: "2025-12-10",
      distinctRawDescriptions: ["ADOBE CREATIVE CLOUD"],
      classification: { category: "likely_saas", confidence: "high", evidence: [{ type: "merchant_dictionary", message: "Known software vendor." }] },
      recurring: { status: "likely_recurring", confidence: "high", strength: "strong", interval: "monthly", evidence: [], transactionCount: 6, firstSeen: "2025-07-10", lastSeen: "2025-12-10", typicalAmount: null, amountProfile: "highly_stable", intervalConsistency: 1, patternSpanMonths: 6, gapCount: 0, priceChange: null },
      softwareStatus: "software",
      totalSpend: 8994,
      typicalTransactionAmount: null,
      estimatedMonthlySpend: 1499,
      estimatedYearlySpend: 17988,
      review: { status: "strong_review", confidence: "high", score: 8, reasons: [{ type: "recurring_software", message: "Recurring software payments." }] },
    };
    const detail = deriveMerchantDetail(reportMerchant);
    const invA = deriveInvestigation(detail);
    const invB = deriveInvestigation(deriveMerchantDetail(JSON.parse(JSON.stringify(reportMerchant))));
    expect(invA).toEqual(invB);
  });

  it("15: no savings/waste/guaranteed-cancellation language across scenarios", () => {
    const details = [
      baseDetail(),
      reviewStatus(baseDetail(), "review"),
      reviewStatus(baseDetail(), "insufficient_evidence"),
      reviewStatus(baseDetail(), "no_concern"),
      withRecurring(baseDetail(), { priceChange: { from: 1000, to: 1200 }, gapCount: 2 }),
      baseDetail({
        classification: { category: "unknown", confidence: "low", evidence: [] },
        classificationEvidence: [{ type: "generic_merchant", message: "low signal" }],
        softwareSpend: { status: "uncertain", totalSpend: 0, estimatedMonthlySpend: null, estimatedYearlySpend: null },
      }),
      withRecurring(baseDetail(), { strength: "weak", patternSpanMonths: 1 }),
    ];
    for (const d of details) {
      const text = allText(deriveInvestigation(d)).toLowerCase();
      for (const banned of FORBIDDEN) {
        expect(text, `${banned} appeared for scenario`).not.toContain(banned);
      }
    }
  });

  it("16: high priority only from strong_review or strong+long+meaningful recurring", () => {
    expect(deriveInvestigation(baseDetail()).priority).toBe("high");
    // strong recurring but not long history and only review -> medium
    const reviewButShort = withRecurring(baseDetail(), { patternSpanMonths: 2 });
    expect(deriveInvestigation(reviewStatus(reviewButShort, "review")).priority).toBe("medium");
    // strong + long + meaningful but no review -> high
    const strongLong = withRecurring(baseDetail(), { patternSpanMonths: 12 });
    expect(deriveInvestigation(reviewStatus(strongLong, "no_concern")).priority).toBe("low");
  });
});

function allText(inv: { summary: string; actions: { label: string; explanation: string }[]; caveats: string[] }): string {
  return [
    inv.summary,
    ...inv.actions.flatMap((a) => [a.label, a.explanation]),
    ...inv.caveats,
  ].join(" ");
}