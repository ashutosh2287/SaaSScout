import { describe, expect, it } from "vitest";
import type { NormalizedTransaction } from "../parse/types";
import { inspectDataQuality } from "../quality";
import { normalizeMerchants } from "../merchant";
import { classifyMerchants } from "../classification";
import { detectRecurring } from "../recurring";

const TXNS: NormalizedTransaction[] = [
  { id: "r1", date: "2026-08-01", description: "ADOBE *CREATIVE CLOUD", amount: -59.99, sourceRow: 2 },
  { id: "r2", date: "2026-08-02", description: "SLACK", amount: -8.0, sourceRow: 3 },
  { id: "r3", date: "2026-08-03", description: "PAYPAL *ADOBE", amount: -60.0, sourceRow: 4 },
  { id: "r4", date: "2026-08-04", description: "GROCERY STORE", amount: -40.0, sourceRow: 5 },
  { id: "r5", date: "2026-08-05", description: "PAYMENT", amount: -5.0, sourceRow: 6 },
];

describe("regression: step 5 — quality", () => {
  it("produces valid diagnostics without throwing", () => {
    const q = inspectDataQuality(TXNS);
    expect(q.totalTransactions).toBe(5);
    expect(q.validTransactions).toBe(5);
    expect(q.score).toBeGreaterThanOrEqual(0);
    expect(q.score).toBeLessThanOrEqual(100);
    expect(["Good", "Fair", "Needs attention"]).toContain(q.level);
  });
});

describe("regression: step 6 — merchant normalization", () => {
  it("resolves Adobe from alias", () => {
    const result = normalizeMerchants(TXNS);
    const adobeTxns = result.transactions.filter((t) => t.merchant.canonicalName === "Adobe");
    expect(adobeTxns.length).toBeGreaterThanOrEqual(1);
    expect(result.resolvedCount).toBeGreaterThanOrEqual(4);
  });

  it("extracts underlying merchant from PAYPAL *ADOBE", () => {
    const result = normalizeMerchants(TXNS);
    const txn9 = result.transactions.find((t) => t.id === "r3");
    expect(txn9?.merchant.canonicalName).toBe("Adobe");
  });

  it("resolves Slack from dictionary", () => {
    const result = normalizeMerchants(TXNS);
    const slackTxn = result.transactions.find((t) => t.id === "r2");
    expect(slackTxn?.merchant.canonicalName).toBe("Slack");
  });

  it("leaves generic descriptions unresolved", () => {
    const result = normalizeMerchants(TXNS);
    const paymentTxn = result.transactions.find((t) => t.id === "r5");
    expect(paymentTxn?.merchant.canonicalName).toBeNull();
    expect(paymentTxn?.merchant.source).toBe("unresolved");
  });

  it("groups merchants sorted by transaction count", () => {
    const result = normalizeMerchants(TXNS);
    expect(result.merchants.length).toBeGreaterThanOrEqual(3);
    const counts = result.merchants.map((m) => m.transactionCount);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i - 1]).toBeGreaterThanOrEqual(counts[i]);
    }
  });
});

describe("regression: step 7 — classification", () => {
  const merchantResult = normalizeMerchants(TXNS);
  const classified = classifyMerchants(merchantResult.merchants).merchants;

  it("classifies Adobe as likely_software", () => {
    const adobe = classified.find((m) => m.canonicalName === "Adobe");
    expect(adobe?.classification.category).toBe("likely_software");
  });

  it("classifies Slack as likely_saas", () => {
    const slack = classified.find((m) => m.canonicalName === "Slack");
    expect(slack?.classification.category).toBe("likely_saas");
  });

  it("classifies Grocery Store as not_software", () => {
    const grocery = classified.find((m) => m.canonicalName === "Grocery Store");
    expect(grocery?.classification.category).toBe("not_software");
  });

  it("every non-unknown result carries evidence", () => {
    for (const m of classified) {
      if (m.classification.category !== "unknown") {
        expect(m.classification.evidence.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("regression: step 8 — recurring", () => {
  const merchantResult = normalizeMerchants(TXNS);
  const result = detectRecurring(merchantResult.transactions);

  it("produces a per-merchant pattern map without throwing", () => {
    expect(result.patterns.size).toBeGreaterThan(0);
    expect(result.patterns.get("adobe")).toBeDefined();
  });

  it("reports a coherent dataset summary", () => {
    expect(result.summary.totalAnalyzed).toBe(result.patterns.size);
    const sum =
      result.summary.likelyRecurringCount +
      result.summary.possiblyRecurringCount +
      result.summary.notRecurringCount +
      result.summary.insufficientDataCount;
    expect(sum).toBe(result.summary.totalAnalyzed);
  });
});