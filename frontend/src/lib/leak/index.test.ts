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
import { monthsBetween } from "./signals";

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
    totalSpend?: number;
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
    totalSpend: opts.totalSpend ?? 0,
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
    typical?: number | null;
    stable?: boolean;
    transactions?: number;
    first?: string;
    last?: string;
  } = {},
): RecurringPattern {
  return {
    status,
    confidence: status === "likely_recurring" ? "high" : "medium",
    interval,
    evidence: opts.stable === false ? [{ type: "amount_variation", message: "varies" }] : [{ type: "stable_amount", message: "stable" }],
    transactionCount: opts.transactions ?? 1,
    firstSeen: opts.first ?? null,
    lastSeen: opts.last ?? null,
    typicalAmount: opts.typical === undefined ? 100 : opts.typical,
    strength: status === "likely_recurring" ? "moderate" : status === "insufficient_data" ? "insufficient" : "weak",
    amountProfile: opts.stable === false ? "variable" : "highly_stable",
    intervalConsistency: 1,
    patternSpanMonths: monthsBetween(opts.first ?? null, opts.last ?? null) || 0,
    gapCount: 0,
    priceChange: null,
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

// ---------- identity for pipeline ----------

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

// ---------- tests ----------

describe("Step 10 subscription leak / spend review detection", () => {
  describe("status policy", () => {
    it("strong candidate -> strong_review with multiple reasons", () => {
      const res = detect([
        merchant("adobe", {
          category: "likely_software",
          recurring: recurring("likely_recurring", "monthly", {
            typical: 1499, stable: true, transactions: 12,
            first: "2026-01-05", last: "2026-12-05",
          }),
          transactionCount: 12,
          monthly: 1499, yearly: 1499 * 12,
        }),
      ]);
      const adobe = byKey(res.reviews, "adobe");
      expect(adobe?.status).toBe("strong_review");
      expect(adobe?.confidence).toBe("high");
      expect(adobe?.score).toBeGreaterThanOrEqual(7);
      expect(hasReason(adobe!, "recurring_software")).toBe(true);
      expect(hasReason(adobe!, "many_occurrences")).toBe(true);
      expect(hasReason(adobe!, "stable_recurring_charge")).toBe(true);
      expect(adobe!.reasons.length).toBeGreaterThanOrEqual(3);
    });

    it("moderate candidate (4 payments, possibly recurring) -> review", () => {
      const res = detect([
        merchant("slack", {
          category: "likely_saas",
          recurring: recurring("possibly_recurring", "monthly", { stable: true, transactions: 4 }),
          transactionCount: 4,
          monthly: 799, yearly: 799 * 12,
        }),
      ]);
      expect(byKey(res.reviews, "slack")?.status).toBe("review");
      expect(byKey(res.reviews, "slack")?.score).toBeLessThan(7);
    });

    it("software + one transaction + insufficient_data -> insufficient_evidence", () => {
      const res = detect([
        merchant("adobe", {
          category: "likely_software",
          recurring: recurring("insufficient_data", null, { transactions: 1 }),
          transactionCount: 1,
          monthly: null, yearly: null,
        }),
      ]);
      const adobe = byKey(res.reviews, "adobe");
      expect(adobe?.status).toBe("insufficient_evidence");
      expect(hasReason(adobe!, "insufficient_history")).toBe(true);
    });

    it("software + not recurring -> no_concern", () => {
      const res = detect([
        merchant("steam", {
          category: "likely_software",
          recurring: recurring("not_recurring", "irregular", { transactions: 3 }),
          transactionCount: 3,
          monthly: null, yearly: null,
        }),
      ]);
      expect(byKey(res.reviews, "steam")?.status).toBe("no_concern");
    });

    it("unknown merchant recurring -> insufficient_evidence (not a leak)", () => {
      const res = detect([
        merchant("shop", {
          status: "uncertain",
          category: "unknown",
          recurring: recurring("likely_recurring", "monthly", { transactions: 12 }),
          transactionCount: 12,
        }),
      ]);
      const shop = byKey(res.reviews, "shop");
      expect(shop?.status).toBe("insufficient_evidence");
      expect(hasReason(shop!, "uncertain_classification")).toBe(true);
      expect(res.summary.strongReviewCount).toBe(0);
    });

    it("non-software recurring (electricity) -> no software review signal", () => {
      const res = detect([
        merchant("electricity", {
          status: "non_software",
          category: "not_software",
          recurring: recurring("likely_recurring", "monthly", { transactions: 12 }),
          transactionCount: 12,
        }),
      ]);
      expect(byKey(res.reviews, "electricity")?.status).toBe("no_concern");
      expect(res.summary.strongReviewCount).toBe(0);
      expect(res.summary.reviewCount).toBe(0);
    });
  });

  describe("false-positive protection (pipeline)", () => {
    it("repeated Amazon purchases must NOT become a SaaS leak", () => {
      const software = pipeline([
        tx("1", "amazon", "AMAZON", "2026-01-05", -1500),
        tx("2", "amazon", "AMAZON", "2026-02-05", -300),
        tx("3", "amazon", "AMAZON", "2026-03-05", -900),
        tx("4", "amazon", "AMAZON", "2026-04-05", -120),
      ]);
      const res = detect(software.merchants);
      const amazon = byKey(res.reviews, "amazon");
      expect(amazon?.status).not.toBe("strong_review");
      expect(amazon?.status).not.toBe("review");
    });

    it("repeated standalone PayPal must NOT become a software leak", () => {
      const software = pipeline([
        tx("1", "paypal", "PAYPAL", "2026-01-05", -1000),
        tx("2", "paypal", "PAYPAL", "2026-02-05", -1000),
        tx("3", "paypal", "PAYPAL", "2026-03-05", -1000),
        tx("4", "paypal", "PAYPAL", "2026-04-05", -1000),
      ]);
      const res = detect(software.merchants);
      const paypal = byKey(res.reviews, "paypal");
      expect(paypal?.status).not.toBe("strong_review");
      expect(paypal?.status).not.toBe("review");
    });

    it("PAYPAL *ADOBE extracts underlying Adobe as a software candidate", () => {
      const software = pipeline([
        tx("1", "paypal", "PAYPAL *ADOBE", "2026-01-05", -999),
        tx("2", "adobe", "ADOBE", "2026-02-05", -999),
        tx("3", "adobe", "ADOBE", "2026-03-05", -999),
        tx("4", "adobe", "ADOBE", "2026-04-05", -999),
        tx("5", "adobe", "ADOBE", "2026-05-05", -999),
        tx("6", "adobe", "ADOBE", "2026-06-05", -999),
        tx("7", "adobe", "ADOBE", "2026-07-05", -999),
        tx("8", "adobe", "ADOBE", "2026-08-05", -999),
        tx("9", "adobe", "ADOBE", "2026-09-05", -999),
        tx("10", "adobe", "ADOBE", "2026-10-05", -999),
        tx("11", "adobe", "ADOBE", "2026-11-05", -999),
        tx("12", "adobe", "ADOBE", "2026-12-05", -999),
      ]);
      const res = detect(software.merchants);
      const adobe = byKey(res.reviews, "adobe");
      expect(adobe?.status).toBe("strong_review");
      expect(adobe?.merchantName).toBe("Adobe");
    });
  });

  describe("spend magnitude", () => {
    it("high spend strengthens the review signal", () => {
      const high = detect([
        merchant("high", {
          recurring: recurring("likely_recurring", "monthly", { stable: true, transactions: 12 }),
          transactionCount: 12, monthly: 100000, yearly: 1200000,
        }),
      ]);
      const low = detect([
        merchant("low", {
          recurring: recurring("likely_recurring", "monthly", { stable: true, transactions: 12 }),
          transactionCount: 12, monthly: 5, yearly: 60,
        }),
      ]);
      expect(byKey(high.reviews, "high")?.status).toBe("strong_review");
      // low spend must not force no_concern when other evidence is strong
      expect(byKey(low.reviews, "low")?.status).toBe("strong_review");
      expect(byKey(high.reviews, "high")?.score).toBeGreaterThan(
        byKey(low.reviews, "low")!.score,
      );
    });
  });

  describe("history length", () => {
    it("12+ payments strengthen review evidence", () => {
      const res = detect([
        merchant("long", {
          recurring: recurring("likely_recurring", "monthly", {
            stable: true, transactions: 12, first: "2026-01-05", last: "2026-12-05",
          }),
          transactionCount: 12, monthly: 1499, yearly: 1499 * 12,
        }),
      ]);
      expect(byKey(res.reviews, "long")?.status).toBe("strong_review");
      expect(hasReason(byKey(res.reviews, "long")!, "long_running")).toBe(true);
    });

    it("1-2 transactions must not create strong review", () => {
      for (const n of [1, 2]) {
        const res = detect([
          merchant("x", {
            recurring: recurring("likely_recurring", "monthly", { stable: true, transactions: n }),
            transactionCount: n, monthly: 99999, yearly: 99999 * 12,
          }),
        ]);
        const r = byKey(res.reviews, "x")!;
        expect(r.status).not.toBe("strong_review");
        if (n === 1) expect(r.status).toBe("insufficient_evidence");
      }
    });

    it("monthsBetween computes history span", () => {
      expect(monthsBetween("2026-01-05", "2026-12-05")).toBeGreaterThanOrEqual(10);
      expect(monthsBetween("2026-01-05", "2026-02-05")).toBeLessThanOrEqual(1);
      expect(monthsBetween(null, "2026-12-05")).toBe(0);
      expect(monthsBetween("2026-12-05", "2026-01-05")).toBe(0);
    });
  });

  describe("amount stability", () => {
    it("stable amount keeps full recurring confidence", () => {
      const res = detect([
        merchant("stable", {
          recurring: recurring("likely_recurring", "monthly", { stable: true, transactions: 8 }),
          transactionCount: 8, monthly: 999, yearly: 999 * 12,
        }),
      ]);
      expect(byKey(res.reviews, "stable")?.score).toBe(7);
    });

    it("amount variation reduces the recurring contribution", () => {
      const res = detect([
        merchant("var", {
          recurring: recurring("likely_recurring", "monthly", { stable: false, transactions: 8 }),
          transactionCount: 8, monthly: 999, yearly: 999 * 12,
        }),
      ]);
      expect(byKey(res.reviews, "var")?.score).toBe(6);
    });
  });

  describe("data quality gate", () => {
    it("blocked dataset prevents strong conclusions", () => {
      const res = detect(
        [
          merchant("adobe", {
            recurring: recurring("likely_recurring", "monthly", { stable: true, transactions: 12 }),
            transactionCount: 12, monthly: 1499, yearly: 1499 * 12,
          }),
        ],
        BLOCKED,
      );
      const adobe = byKey(res.reviews, "adobe");
      expect(adobe?.status).toBe("insufficient_evidence");
      expect(adobe?.confidence).toBe("low");
      expect(res.summary.strongReviewCount).toBe(0);
      expect(res.dataQuality).toBe("blocked");
    });

    it("needs_attention caps confidence and adds a quality reason", () => {
      const res = detect(
        [
          merchant("adobe", {
            recurring: recurring("likely_recurring", "monthly", { stable: true, transactions: 12 }),
            transactionCount: 12, monthly: 1499, yearly: 1499 * 12,
          }),
        ],
        ATTENTION,
      );
      const adobe = byKey(res.reviews, "adobe");
      expect(adobe?.confidence).toBe("medium");
      expect(hasReason(adobe!, "poor_data_quality")).toBe(true);
    });

    it("needs_attention does not prevent a review status", () => {
      const res = detect(
        [
          merchant("adobe", {
            recurring: recurring("likely_recurring", "monthly", { stable: true, transactions: 12 }),
            transactionCount: 12, monthly: 1499, yearly: 1499 * 12,
          }),
        ],
        ATTENTION,
      );
      expect(byKey(res.reviews, "adobe")?.status).toBe("strong_review");
    });
  });

  describe("refunds and zeros", () => {
    it("refunds do not inflate review spend (Step 9 already excludes them)", () => {
      const software = pipeline([
        tx("1", "adobe", "ADOBE", "2026-01-05", -999),
        tx("2", "adobe", "ADOBE", "2026-02-05", -999),
        tx("3", "adobe", "ADOBE", "2026-03-05", -999),
        tx("4", "adobe", "ADOBE", "2026-04-05", -999),
        tx("5", "adobe", "ADOBE", "2026-05-05", -999),
        tx("6", "adobe", "ADOBE", "2026-06-05", -999),
        tx("7", "adobe", "ADOBE", "2026-07-05", -999),
        tx("8", "adobe", "ADOBE", "2026-08-05", -999),
        tx("9", "adobe", "ADOBE", "2026-09-05", -999),
        tx("10", "adobe", "ADOBE", "2026-10-05", -999),
        tx("11", "adobe", "ADOBE", "2026-11-05", -999),
        tx("12", "adobe", "ADOBE", "2026-12-05", -999),
        tx("13", "adobe", "ADOBE", "2026-12-20", 999), // refund
      ]);
      const adobe = pipeline([tx("1", "adobe", "ADOBE", "2026-01-05", -999), tx("2", "adobe", "ADOBE", "2026-02-05", -999), tx("3", "adobe", "ADOBE", "2026-03-05", -999), tx("4", "adobe", "ADOBE", "2026-04-05", -999), tx("5", "adobe", "ADOBE", "2026-05-05", -999), tx("6", "adobe", "ADOBE", "2026-06-05", -999), tx("7", "adobe", "ADOBE", "2026-07-05", -999), tx("8", "adobe", "ADOBE", "2026-08-05", -999), tx("9", "adobe", "ADOBE", "2026-09-05", -999), tx("10", "adobe", "ADOBE", "2026-10-05", -999), tx("11", "adobe", "ADOBE", "2026-11-05", -999), tx("12", "adobe", "ADOBE", "2026-12-05", -999)]);
      const res = detect(software.merchants);
      const resBase = detect(adobe.merchants);
      expect(res.summary.estimatedMonthlyReviewSpend).toBe(resBase.summary.estimatedMonthlyReviewSpend);
      expect(res.summary.estimatedYearlyReviewSpend).toBe(resBase.summary.estimatedYearlyReviewSpend);
    });

    it("zero amounts do not affect review spend", () => {
      const software = pipeline([
        tx("1", "adobe", "ADOBE", "2026-01-05", -999),
        tx("2", "adobe", "ADOBE", "2026-02-05", -999),
        tx("3", "adobe", "ADOBE", "2026-03-05", -999),
        tx("4", "adobe", "ADOBE", "2026-04-05", -999),
        tx("5", "adobe", "ADOBE", "2026-05-05", 0), // zero, not spend
      ]);
      const res = detect(software.merchants);
      const adobe = byKey(res.reviews, "adobe");
      expect(adobe?.estimatedMonthlySpend).toBe(999);
      expect(res.summary.estimatedMonthlyReviewSpend).toBeLessThanOrEqual(999 * 12);
    });
  });

  describe("no fake savings", () => {
    it("review spend is an estimate and no savings field exists", () => {
      const res = detect([
        merchant("adobe", {
          recurring: recurring("likely_recurring", "monthly", { stable: true, transactions: 12 }),
          transactionCount: 12, monthly: 1499, yearly: 1499 * 12,
        }),
      ]);
      // Type-level guarantee: no savings field on summary or review.
      expect("potentialSavings" in res.summary).toBe(false);
      expect("potentialSavings" in res.reviews[0]).toBe(false);
      expect(res.summary.estimatedMonthlyReviewSpend).toBe(1499);
      expect(res.summary.estimatedYearlyReviewSpend).toBe(1499 * 12);
    });
  });

  describe("summary", () => {
    it("counts every status and sums review spend", () => {
      const res = detect([
        merchant("a", { recurring: recurring("likely_recurring", "monthly", { stable: true, transactions: 12 }), transactionCount: 12, monthly: 1000, yearly: 12000 }),
        merchant("b", { recurring: recurring("possibly_recurring", "monthly", { stable: true, transactions: 4 }), transactionCount: 4, monthly: 500, yearly: 6000 }),
        merchant("c", { status: "non_software", category: "not_software", recurring: recurring("likely_recurring", "monthly", { transactions: 12 }), transactionCount: 12 }),
        merchant("d", { status: "uncertain", category: "unknown", recurring: recurring("likely_recurring", "monthly", { transactions: 12 }), transactionCount: 12 }),
      ]);
      expect(res.summary.strongReviewCount).toBe(1);
      expect(res.summary.reviewCount).toBe(1);
      expect(res.summary.noConcernCount).toBe(1);
      expect(res.summary.insufficientEvidenceCount).toBe(1);
      expect(res.summary.estimatedMonthlyReviewSpend).toBe(1500);
      expect(res.summary.estimatedYearlyReviewSpend).toBe(18000);
      expect(res.reviews.length).toBe(4);
    });

    it("empty dataset -> empty summary", () => {
      const res = detect([], READY);
      expect(res.reviews).toHaveLength(0);
      expect(res.summary.strongReviewCount).toBe(0);
      expect(res.summary.estimatedMonthlyReviewSpend).toBe(0);
    });
  });

  describe("determinism and immutability", () => {
    it("same input -> same output", () => {
      const merchants = [
        merchant("adobe", { recurring: recurring("likely_recurring", "monthly", { stable: true, transactions: 8 }), transactionCount: 8, monthly: 999, yearly: 999 * 12 }),
        merchant("slack", { recurring: recurring("possibly_recurring", "monthly", { transactions: 4 }), transactionCount: 4, monthly: 799, yearly: 799 * 12 }),
      ];
      expect(detect(merchants)).toEqual(detect(merchants));
    });

    it("does not mutate input merchants", () => {
      const merchants = [
        merchant("adobe", { recurring: recurring("likely_recurring", "monthly", { stable: true, transactions: 8 }), transactionCount: 8, monthly: 999, yearly: 999 * 12 }),
      ];
      const snapshot = JSON.stringify(merchants);
      detect(merchants);
      expect(JSON.stringify(merchants)).toBe(snapshot);
    });

    it("sorts deterministically (status then monthly then key)", () => {
      const res = detect([
        merchant("b", { recurring: recurring("likely_recurring", "monthly", { transactions: 8 }), transactionCount: 8, monthly: 200, yearly: 2400 }),
        merchant("a", { recurring: recurring("likely_recurring", "monthly", { transactions: 8 }), transactionCount: 8, monthly: 999, yearly: 999 * 12 }),
        merchant("c", { status: "uncertain", category: "unknown", recurring: recurring("likely_recurring", "monthly", { transactions: 8 }), transactionCount: 8 }),
      ]);
      const keys = res.reviews.map((r) => r.merchantKey);
      // a (higher monthly) before b; unknown c last
      expect(keys).toEqual(["a", "b", "c"]);
    });
  });

  describe("Step 27 — unclear ownership (recurring software that the classification could not identify)", () => {
    it("fires on a software merchant with an unknown classification that reaches review", () => {
      const res = detect([
        merchant("mystery-svc", {
          // status "software" — the aggregate layer accepts it as a software
          // candidate (not in any non-software list) — but the classification
          // engine could not identify it.
          status: "software",
          category: "unknown",
          categoryConfidence: "low",
          recurring: recurring("likely_recurring", "monthly", {
            stable: true, transactions: 8, typical: 49,
            first: "2026-01-05", last: "2026-08-05",
          }),
          transactionCount: 8,
          monthly: 49, yearly: 49 * 12,
        }),
      ]);
      const r = byKey(res.reviews, "mystery-svc");
      expect(r?.status === "review" || r?.status === "strong_review").toBe(true);
      expect(hasReason(r!, "unclear_ownership")).toBe(true);
      expect(res.summary.unclearOwnershipCount).toBe(1);
    });

    it("does NOT fire when classification is known (likely_saas / likely_software / not_software)", () => {
      const res = detect([
        merchant("adobe", {
          status: "software",
          category: "likely_software",
          recurring: recurring("likely_recurring", "monthly", {
            stable: true, transactions: 12, typical: 50, first: "2026-01-05", last: "2026-12-05",
          }),
          transactionCount: 12, monthly: 50, yearly: 50 * 12,
        }),
        merchant("electric", {
          status: "non_software",
          category: "not_software",
          recurring: recurring("likely_recurring", "monthly", { transactions: 12 }),
          transactionCount: 12,
        }),
      ]);
      expect(res.summary.unclearOwnershipCount).toBe(0);
      for (const r of res.reviews) {
        expect(hasReason(r, "unclear_ownership")).toBe(false);
      }
    });

    it("does NOT fire when status is review/strong_review-capable but the merchant never reaches a review status", () => {
      // A software merchant with only 1 payment lands in
      // insufficient_evidence; the gate is explicit and the reason does
      // not fire on a status that is not a review.
      const res = detect([
        merchant("mystery", {
          status: "software",
          category: "unknown",
          categoryConfidence: "low",
          recurring: recurring("insufficient_data", null, { transactions: 1 }),
          transactionCount: 1, monthly: 30, yearly: 360,
        }),
      ]);
      const r = byKey(res.reviews, "mystery");
      expect(r?.status).toBe("insufficient_evidence");
      expect(hasReason(r!, "unclear_ownership")).toBe(false);
      expect(res.summary.unclearOwnershipCount).toBe(0);
    });

    it("does NOT fire when the merchant status is 'uncertain' (already excluded upstream)", () => {
      // m.status === "uncertain" means the aggregate layer already flagged
      // it (e.g. payment processor / mixed). The upstream gate prevents
      // review status, so unclear_ownership cannot fire.
      const res = detect([
        merchant("mystery", {
          status: "uncertain",
          category: "unknown",
          recurring: recurring("likely_recurring", "monthly", { transactions: 12 }),
          transactionCount: 12,
        }),
      ]);
      const r = byKey(res.reviews, "mystery");
      expect(r?.status).toBe("insufficient_evidence");
      expect(hasReason(r!, "unclear_ownership")).toBe(false);
      expect(res.summary.unclearOwnershipCount).toBe(0);
    });

    it("counts each unclear-ownership merchant once (dedup)", () => {
      const res = detect([
        merchant("mystery-a", {
          status: "software",
          category: "unknown",
          categoryConfidence: "low",
          recurring: recurring("likely_recurring", "monthly", { transactions: 12, typical: 50, first: "2026-01-05", last: "2026-12-05" }),
          transactionCount: 12, monthly: 50, yearly: 600,
        }),
        merchant("mystery-b", {
          status: "software",
          category: "unknown",
          categoryConfidence: "low",
          recurring: recurring("likely_recurring", "monthly", { transactions: 8, typical: 30, first: "2026-01-05", last: "2026-08-05" }),
          transactionCount: 8, monthly: 30, yearly: 360,
        }),
        merchant("adobe", {
          status: "software",
          category: "likely_software",
          recurring: recurring("likely_recurring", "monthly", { transactions: 12, typical: 50, first: "2026-01-05", last: "2026-12-05" }),
          transactionCount: 12, monthly: 50, yearly: 600,
        }),
      ]);
      expect(res.summary.unclearOwnershipCount).toBe(2);
      // strong_review and review counts are independent — adobe still
      // counts even though the reason did not fire on it.
      expect(res.summary.strongReviewCount + res.summary.reviewCount).toBeGreaterThanOrEqual(3);
    });

    it("the reason text is plain English and does not invent a category or claim savings", () => {
      const res = detect([
        merchant("mystery", {
          status: "software",
          category: "unknown",
          categoryConfidence: "low",
          recurring: recurring("likely_recurring", "monthly", { transactions: 12, typical: 50 }),
          transactionCount: 12, monthly: 50, yearly: 600,
        }),
      ]);
      const r = byKey(res.reviews, "mystery")!;
      const text = r.reasons.find((x) => x.type === "unclear_ownership")?.message ?? "";
      expect(text.length).toBeGreaterThan(10);
      // Honest copy: no savings / cancel / waste language.
      expect(text.toLowerCase()).not.toContain("saving");
      expect(text.toLowerCase()).not.toContain("cancel");
      expect(text.toLowerCase()).not.toContain("waste");
      expect(text.toLowerCase()).not.toContain("unused");
    });
  });
});
