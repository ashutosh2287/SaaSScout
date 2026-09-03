import { describe, expect, it } from "vitest";
import type { MerchantClassification } from "../classification/types";
import type { RecurringPattern, RecurringStatus, RecurringInterval } from "../recurring/types";
import type { SoftwareSpendMerchant } from "../software/types";
import type { DataQualityDiagnostics, AnalysisReadiness } from "../quality/types";
import { normalizeMerchants } from "../merchant";
import { classifyMerchants } from "../classification";
import { detectRecurring } from "../recurring";
import { aggregateSoftwareSpend } from "../software";
import type { NormalizedTransactionWithMerchant, MerchantIdentity } from "../merchant/types";
import { detectSpendReviews } from "./detect";
import type { ReviewReasonType } from "./types";

// ---------- fixtures ----------

function merchant(
  key: string,
  opts: {
    status?: SoftwareSpendMerchant["status"];
    category?: MerchantClassification["category"];
    categoryConfidence?: MerchantClassification["confidence"];
    recurring?: RecurringPattern | null;
    transactionCount?: number;
    monthly?: number | null;
    yearly?: number | null;
    typical?: number | null;
  } = {},
): SoftwareSpendMerchant {
  const category = opts.category ?? "likely_saas";
  const classification: MerchantClassification = {
    category,
    confidence: opts.categoryConfidence ?? "high",
    evidence: [],
  };
  return {
    normalizedKey: key,
    displayName: key,
    status: opts.status ?? "software",
    classification,
    transactionCount: opts.transactionCount ?? 0,
    totalSpend: 0,
    typicalTransactionAmount: opts.typical ?? null,
    recurring: opts.recurring ?? null,
    estimatedMonthlySpend: opts.monthly === undefined ? null : opts.monthly,
    estimatedYearlySpend: opts.yearly === undefined ? null : opts.yearly,
  };
}

function recurring(
  status: RecurringStatus,
  interval: RecurringInterval,
  opts: {
    strength?: RecurringPattern["strength"];
    amountProfile?: RecurringPattern["amountProfile"];
    consistency?: number;
    gapCount?: number;
    priceChange?: RecurringPattern["priceChange"];
    spanMonths?: number;
    transactions?: number;
  } = {},
): RecurringPattern {
  return {
    status,
    confidence: status === "likely_recurring" ? "high" : "medium",
    interval,
    evidence: [],
    transactionCount: opts.transactions ?? 1,
    firstSeen: null,
    lastSeen: null,
    typicalAmount: 100,
    strength: opts.strength ?? (status === "likely_recurring" ? "moderate" : "weak"),
    amountProfile: opts.amountProfile ?? "highly_stable",
    intervalConsistency: opts.consistency ?? 1,
    patternSpanMonths: opts.spanMonths ?? 0,
    gapCount: opts.gapCount ?? 0,
    priceChange: opts.priceChange ?? null,
  };
}

function dg(readiness: AnalysisReadiness): DataQualityDiagnostics {
  return {
    totalTransactions: 0,
    validTransactions: 0,
    date: { present: 0, missing: 0, invalid: 0 },
    description: { missing: 0, lowInformation: 0 },
    amount: { zero: 0, positive: 0, negative: 0 },
    duplicates: { exact: 0, possible: 0 },
    coverage: { monthsRepresented: 0, transactionsByMonth: {} },
    score: 0,
    level: "Needs attention",
    analysisReadiness: readiness,
    warnings: [],
  };
}

const READY = dg("ready");
const ATTENTION = dg("needs_attention");
const BLOCKED = dg("blocked");

function detect(merchants: SoftwareSpendMerchant[], quality: DataQualityDiagnostics = READY) {
  return detectSpendReviews(merchants, quality);
}

function byKey<T extends { merchantKey: string }>(reviews: T[], key: string): T | undefined {
  return reviews.find((r) => r.merchantKey === key);
}

function hasReason(review: { reasons: { type: ReviewReasonType }[] }, type: ReviewReasonType) {
  return review.reasons.some((r) => r.type === type);
}

// ---------- identity for pipeline false-positive tests ----------

function identity(canonicalName: string, normalizedKey: string): MerchantIdentity {
  return {
    canonicalName,
    normalizedKey,
    source: "dictionary",
    confidence: "high",
    rawDescription: canonicalName,
    cleanedDescription: canonicalName.toUpperCase(),
  };
}

function tx(
  id: string,
  key: string,
  name: string,
  date: string,
  amount: number,
): NormalizedTransactionWithMerchant {
  return {
    id,
    date,
    description: name,
    amount,
    sourceRow: 0,
    merchant: identity(name, key),
  };
}

function pipeline(rows: NormalizedTransactionWithMerchant[]) {
  const merchantResult = normalizeMerchants(rows);
  const classified = classifyMerchants(merchantResult.merchants).merchants;
  const recurring = detectRecurring(merchantResult.transactions);
  const software = aggregateSoftwareSpend(merchantResult.transactions, classified, recurring.patterns);
  return software;
}

// A strong, long-established recurring software pattern.
const STRONG_RECURRING = recurring("likely_recurring", "monthly", {
  strength: "strong",
  amountProfile: "highly_stable",
  consistency: 1,
  gapCount: 0,
  spanMonths: 24,
  transactions: 12,
});

describe("STEP 16 — recurring intelligence feeds review reasoning", () => {
  it("1: strong SaaS + strong recurring -> strong review when history/spend support it", () => {
    const res = detect([
      merchant("adobe", {
        recurring: STRONG_RECURRING,
        transactionCount: 12,
        monthly: 1499,
        yearly: 1499 * 12,
      }),
    ]);
    const r = byKey(res.reviews, "adobe")!;
    expect(r.status).toBe("strong_review");
    expect(r.confidence).toBe("high");
    expect(r.score).toBeGreaterThanOrEqual(7);
  });

  it("2: strong recurring -> stronger review signal than moderate recurring", () => {
    const strong = detect([
      merchant("s", { recurring: STRONG_RECURRING, transactionCount: 12, monthly: 1499 }),
    ]);
    const moderate = detect([
      merchant(
        "m",
        { recurring: recurring("likely_recurring", "monthly", { strength: "moderate", transactions: 3, spanMonths: 3 }), transactionCount: 3, monthly: 1499 },
      ),
    ]);
    const s = byKey(strong.reviews, "s")!;
    const m = byKey(moderate.reviews, "m")!;
    expect(s.status).toBe("strong_review");
    expect(m.status).toBe("review");
    expect(s.score).toBeGreaterThan(m.score);
    expect(s.confidence).toBe("high");
    expect(m.confidence).toBe("medium");
  });

  it("3: weak recurring -> conservative review result (never strong, capped confidence)", () => {
    const res = detect([
      merchant("w", {
        recurring: recurring("likely_recurring", "monthly", {
          strength: "weak",
          amountProfile: "moderately_stable",
          transactions: 4,
          spanMonths: 4,
        }),
        transactionCount: 4,
        monthly: 1499,
      }),
    ]);
    const r = byKey(res.reviews, "w")!;
    expect(r.status).toBe("review");
    expect(r.status).not.toBe("strong_review");
    expect(r.confidence).toBe("medium");
  });

  it("4: unknown merchant + strong recurring -> insufficient_evidence", () => {
    const res = detect([
      merchant("shop", {
        status: "uncertain",
        category: "unknown",
        recurring: STRONG_RECURRING,
        transactionCount: 12,
      }),
    ]);
    const r = byKey(res.reviews, "shop")!;
    expect(r.status).toBe("insufficient_evidence");
    expect(hasReason(r, "uncertain_classification")).toBe(true);
  });

  it("5: non-software + strong recurring -> no_concern", () => {
    const res = detect([
      merchant("electricity", {
        status: "non_software",
        category: "not_software",
        recurring: STRONG_RECURRING,
        transactionCount: 12,
      }),
    ]);
    expect(byKey(res.reviews, "electricity")?.status).toBe("no_concern");
    expect(res.summary.strongReviewCount).toBe(0);
  });

  it("6: one payment -> never strong review", () => {
    const res = detect([
      merchant("x", { recurring: recurring("likely_recurring", "monthly", { transactions: 1 }), transactionCount: 1, monthly: 99999 }),
    ]);
    expect(byKey(res.reviews, "x")?.status).not.toBe("strong_review");
  });

  it("7: two payments -> never strong review", () => {
    const res = detect([
      merchant("x", { recurring: recurring("likely_recurring", "monthly", { transactions: 2 }), transactionCount: 2, monthly: 99999 }),
    ]);
    expect(byKey(res.reviews, "x")?.status).not.toBe("strong_review");
  });

  it("8: three stable monthly payments -> conservative result with limited-evidence reason", () => {
    const res = detect([
      merchant("x", {
        recurring: recurring("likely_recurring", "monthly", { strength: "moderate", transactions: 3, spanMonths: 3 }),
        transactionCount: 3,
        monthly: 1499,
      }),
    ]);
    const r = byKey(res.reviews, "x")!;
    expect(r.status).toBe("review");
    expect(r.status).not.toBe("strong_review");
    expect(hasReason(r, "limited_payments")).toBe(true);
  });

  it("9: long stable history -> stronger evidence than a short pattern", () => {
    const long = detect([merchant("long", { recurring: STRONG_RECURRING, transactionCount: 12, monthly: 1499 })]);
    const short = detect([
      merchant("short", {
        recurring: recurring("likely_recurring", "monthly", { strength: "moderate", transactions: 3, spanMonths: 3 }),
        transactionCount: 3,
        monthly: 1499,
      }),
    ]);
    expect(byKey(long.reviews, "long")?.score).toBeGreaterThan(byKey(short.reviews, "short")!.score);
    expect(hasReason(byKey(long.reviews, "long")!, "long_running")).toBe(true);
  });

  it("10: irregular intervals -> weaker/no recurring contribution", () => {
    const res = detect([
      merchant("irr", {
        recurring: recurring("not_recurring", "irregular", { transactions: 4 }),
        transactionCount: 4,
        monthly: null,
      }),
    ]);
    const r = byKey(res.reviews, "irr")!;
    expect(r.status).not.toBe("strong_review");
    expect(r.status).not.toBe("review");
  });

  it("11: highly stable amount -> positive (adds to) recurring evidence", () => {
    const stable = detect([
      merchant("s", {
        recurring: recurring("likely_recurring", "monthly", { strength: "moderate", amountProfile: "highly_stable", transactions: 8 }),
        transactionCount: 8,
        monthly: 999,
      }),
    ]);
    const variable = detect([
      merchant("v", {
        recurring: recurring("likely_recurring", "monthly", { strength: "moderate", amountProfile: "variable", transactions: 8 }),
        transactionCount: 8,
        monthly: 999,
      }),
    ]);
    expect(byKey(stable.reviews, "s")!.score).toBeGreaterThan(byKey(variable.reviews, "v")!.score);
  });

  it("12: variable amount weakens certainty and caps confidence", () => {
    const res = detect([
      merchant("var", {
        recurring: recurring("likely_recurring", "monthly", { strength: "moderate", amountProfile: "variable", transactions: 12 }),
        transactionCount: 12,
        monthly: 30000,
        yearly: 360000,
      }),
    ]);
    const r = byKey(res.reviews, "var")!;
    // Spend magnitude is high but variable amount caps certainty to medium.
    expect(r.confidence).toBe("medium");
    expect(hasReason(r, "amount_stability")).toBe(true);
  });

  it("13: price increase -> supporting review reason appears", () => {
    const res = detect([
      merchant("adobe", {
        recurring: recurring("likely_recurring", "monthly", {
          strength: "strong",
          amountProfile: "moderately_stable",
          transactions: 12,
          spanMonths: 12,
          priceChange: { from: 2999, to: 3999 },
        }),
        transactionCount: 12,
        monthly: 3999,
      }),
    ]);
    const r = byKey(res.reviews, "adobe")!;
    const priceReason = r.reasons.find((x) => x.type === "price_change");
    expect(priceReason).toBeDefined();
    expect(priceReason!.message).toContain("increased");
  });

  it("14: payment gap -> supporting review reason appears", () => {
    const res = detect([
      merchant("adobe", {
        recurring: recurring("likely_recurring", "monthly", {
          strength: "moderate",
          transactions: 12,
          spanMonths: 12,
          gapCount: 1,
        }),
        transactionCount: 12,
        monthly: 1499,
      }),
    ]);
    expect(hasReason(byKey(res.reviews, "adobe")!, "payment_gap")).toBe(true);
  });

  it("15: needs_attention data quality caps confidence and adds a quality reason", () => {
    const res = detect(
      [merchant("adobe", { recurring: STRONG_RECURRING, transactionCount: 12, monthly: 50000 })],
      ATTENTION,
    );
    const r = byKey(res.reviews, "adobe")!;
    expect(r.confidence).toBe("medium");
    expect(hasReason(r, "poor_data_quality")).toBe(true);
  });

  it("16: blocked data quality -> review unavailable (all insufficient)", () => {
    const res = detect(
      [merchant("adobe", { recurring: STRONG_RECURRING, transactionCount: 12, monthly: 50000 })],
      BLOCKED,
    );
    expect(byKey(res.reviews, "adobe")?.status).toBe("insufficient_evidence");
    expect(byKey(res.reviews, "adobe")?.confidence).toBe("low");
    expect(res.summary.strongReviewCount).toBe(0);
  });

  it("17: no fake savings fields exist", () => {
    const res = detect([merchant("adobe", { recurring: STRONG_RECURRING, transactionCount: 12, monthly: 1499 })]);
    expect("potentialSavings" in res.summary).toBe(false);
    for (const field of ["potentialSavings", "estimatedSavings", "annualSavings", "wasteAmount"]) {
      expect(field in res.reviews[0]).toBe(false);
      expect(field in res.summary).toBe(false);
    }
  });

  it("18: deterministic output for identical input", () => {
    const merchants = [
      merchant("adobe", { recurring: STRONG_RECURRING, transactionCount: 12, monthly: 1499 }),
    ];
    expect(detect(merchants)).toEqual(detect(merchants));
  });

  it("19: does not mutate input merchants", () => {
    const merchants = [
      merchant("adobe", { recurring: STRONG_RECURRING, transactionCount: 12, monthly: 1499 }),
    ];
    const snapshot = JSON.stringify(merchants);
    detect(merchants);
    expect(JSON.stringify(merchants)).toBe(snapshot);
  });

  it("20: repeated Amazon purchases must NOT become a SaaS review", () => {
    const software = pipeline([
      tx("1", "amazon", "AMAZON", "2026-01-05", -1500),
      tx("2", "amazon", "AMAZON", "2026-02-05", -300),
      tx("3", "amazon", "AMAZON", "2026-03-05", -900),
      tx("4", "amazon", "AMAZON", "2026-04-05", -120),
    ]);
    const r = byKey(detect(software.merchants).reviews, "amazon");
    expect(r?.status).not.toBe("strong_review");
    expect(r?.status).not.toBe("review");
  });

  it("21: repeated standalone PayPal must NOT become a software review", () => {
    const software = pipeline([
      tx("1", "paypal", "PAYPAL", "2026-01-05", -1000),
      tx("2", "paypal", "PAYPAL", "2026-02-05", -1000),
      tx("3", "paypal", "PAYPAL", "2026-03-05", -1000),
      tx("4", "paypal", "PAYPAL", "2026-04-05", -1000),
    ]);
    const r = byKey(detect(software.merchants).reviews, "paypal");
    expect(r?.status).not.toBe("strong_review");
    expect(r?.status).not.toBe("review");
  });

  it("22: PAYPAL *ADOBE extracts underlying Adobe as a reviewable software candidate", () => {
    const adobeTxns = Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, "0");
      return tx(String(i + 1), "adobe", "ADOBE", `2026-${month}-05`, -999);
    });
    const software = pipeline([
      tx("p", "paypal", "PAYPAL *ADOBE", "2026-01-06", -999),
      ...adobeTxns,
    ]);
    const r = byKey(detect(software.merchants).reviews, "adobe")!;
    expect(r).toBeDefined();
    expect(r.status).toBe("strong_review");
    expect(r.merchantName).toBe("Adobe");
  });

  it("reasons never expose internal scoring terms", () => {
    const res = detect([merchant("adobe", { recurring: STRONG_RECURRING, transactionCount: 12, monthly: 1499 })]);
    const joined = res.reviews[0].reasons.map((x) => x.message).join(" ");
    expect(joined).not.toMatch(/threshold|points|score|axis|weight|RECUR_|PTS|STRONG_/i);
  });
});