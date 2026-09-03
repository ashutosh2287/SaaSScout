import { describe, expect, it } from "vitest";
import type {
  MerchantIdentity,
  NormalizedTransactionWithMerchant,
} from "../merchant/types";
import { analyzeMerchant, detectRecurring } from "./detect";
import { classifyGap } from "./intervals";

function identity(canonicalName: string, normalizedKey: string): MerchantIdentity {
  return {
    canonicalName,
    normalizedKey,
    source: "deterministic",
    confidence: "medium",
    rawDescription: canonicalName,
    cleanedDescription: canonicalName.toUpperCase(),
  };
}

// Payments are money out, so amounts are negative (Step 4 sign semantics).
function tx(
  id: string,
  normalizedKey: string,
  canonicalName: string,
  date: string,
  amount: number,
): NormalizedTransactionWithMerchant {
  return {
    id,
    date,
    description: canonicalName,
    amount,
    sourceRow: 0,
    merchant: identity(canonicalName, normalizedKey),
  };
}

function analyze(rows: NormalizedTransactionWithMerchant[]) {
  return analyzeMerchant(rows);
}

describe("Step 8 recurring detection", () => {
  describe("monthly", () => {
    it("detects a stable monthly pattern as likely recurring / high", () => {
      const p = analyze([
        tx("1", "adobe", "Adobe", "2026-01-05", -1499),
        tx("2", "adobe", "Adobe", "2026-02-05", -1499),
        tx("3", "adobe", "Adobe", "2026-03-05", -1499),
        tx("4", "adobe", "Adobe", "2026-04-05", -1499),
      ]);
      expect(p.status).toBe("likely_recurring");
      expect(p.interval).toBe("monthly");
      expect(p.confidence).toBe("high");
      expect(p.typicalAmount).toBe(1499);
      expect(p.transactionCount).toBe(4);
    });

    it("recognizes month-end billing as monthly", () => {
      const p = analyze([
        tx("1", "m", "M", "2026-01-31", -100),
        tx("2", "m", "M", "2026-02-28", -100),
        tx("3", "m", "M", "2026-03-31", -100),
        tx("4", "m", "M", "2026-04-30", -100),
      ]);
      expect(p.status).toBe("likely_recurring");
      expect(p.interval).toBe("monthly");
    });
  });

  describe("quarterly", () => {
    it("detects a quarterly pattern", () => {
      const p = analyze([
        tx("1", "q", "Q", "2026-01-10", -500),
        tx("2", "q", "Q", "2026-04-10", -500),
        tx("3", "q", "Q", "2026-07-10", -500),
        tx("4", "q", "Q", "2026-10-10", -500),
      ]);
      expect(p.status).toBe("likely_recurring");
      expect(p.interval).toBe("quarterly");
      expect(p.confidence).toBe("high");
    });
  });

  describe("annual", () => {
    it("detects an annual pattern with conservative confidence for few points", () => {
      const p = analyze([
        tx("1", "a", "A", "2024-01-10", -2000),
        tx("2", "a", "A", "2025-01-10", -2000),
        tx("3", "a", "A", "2026-01-10", -2000),
      ]);
      expect(p.status).toBe("likely_recurring");
      expect(p.interval).toBe("annual");
      expect(p.confidence).toBe("medium"); // only 2 gaps, deliberately conservative
    });

    it("raises annual confidence with more observations", () => {
      const p = analyze([
        tx("1", "a", "A", "2023-01-10", -2000),
        tx("2", "a", "A", "2024-01-10", -2000),
        tx("3", "a", "A", "2025-01-10", -2000),
        tx("4", "a", "A", "2026-01-10", -2000),
      ]);
      expect(p.status).toBe("likely_recurring");
      expect(p.interval).toBe("annual");
      expect(p.confidence).toBe("high");
    });
  });

  describe("weekly", () => {
    it("detects a weekly pattern but keeps confidence capped at medium", () => {
      const p = analyze([
        tx("1", "w", "W", "2026-01-05", -30),
        tx("2", "w", "W", "2026-01-12", -30),
        tx("3", "w", "W", "2026-01-19", -30),
        tx("4", "w", "W", "2026-01-26", -30),
      ]);
      expect(p.status).toBe("likely_recurring");
      expect(p.interval).toBe("weekly");
      expect(p.confidence).toBe("medium");
    });
  });

  describe("amounts", () => {
    it("payloads exact stable amounts as high confidence", () => {
      const p = analyze([
        tx("1", "s", "S", "2026-01-05", -1499),
        tx("2", "s", "S", "2026-02-05", -1499),
        tx("3", "s", "S", "2026-03-05", -1499),
        tx("4", "s", "S", "2026-04-05", -1499),
      ]);
      expect(p.confidence).toBe("high");
      expect(p.evidence.some((e) => e.type === "stable_amount")).toBe(true);
    });

    it("treats slight amount variation as still stable", () => {
      const p = analyze([
        tx("1", "s", "S", "2026-01-05", -1499),
        tx("2", "s", "S", "2026-02-05", -1500),
        tx("3", "s", "S", "2026-03-05", -1499),
        tx("4", "s", "S", "2026-04-05", -1498),
      ]);
      expect(p.status).toBe("likely_recurring");
      expect(p.confidence).toBe("high");
    });

    it("lowers confidence when amounts vary significantly", () => {
      const p = analyze([
        tx("1", "s", "S", "2026-01-05", -1499),
        tx("2", "s", "S", "2026-02-05", -1499),
        tx("3", "s", "S", "2026-03-05", -5999),
        tx("4", "s", "S", "2026-04-05", -1499),
      ]);
      expect(p.status).toBe("possibly_recurring");
      expect(p.confidence).toBe("medium");
      expect(p.evidence.some((e) => e.type === "amount_variation")).toBe(true);
    });
  });

  describe("insufficient data", () => {
    it("one transaction is insufficient_data", () => {
      const p = analyze([tx("1", "u", "U", "2026-01-05", -100)]);
      expect(p.status).toBe("insufficient_data");
      expect(p.interval).toBeNull();
    });

    it("two matching transactions are not automatically high confidence", () => {
      const p = analyze([
        tx("1", "u", "U", "2026-01-05", -100),
        tx("2", "u", "U", "2026-02-05", -100),
      ]);
      expect(p.status).toBe("possibly_recurring");
      expect(p.confidence).toBe("low");
    });
  });

  describe("irregular", () => {
    it("does not detect an irregular pattern as monthly", () => {
      const p = analyze([
        tx("1", "u", "U", "2026-01-10", -100),
        tx("2", "u", "U", "2026-03-20", -100),
        tx("3", "u", "U", "2026-08-05", -100),
        tx("4", "u", "U", "2026-12-25", -100),
      ]);
      expect(p.status).toBe("not_recurring");
      expect(p.interval).toBe("irregular");
    });
  });

  describe("refunds and zero amounts", () => {
    it("excludes refunds (positive amounts) from payment occurrences", () => {
      const p = analyze([
        tx("1", "r", "R", "2026-01-05", -100),
        tx("2", "r", "R", "2026-02-05", 100), // refund, not a payment
        tx("3", "r", "R", "2026-03-05", -100),
        tx("4", "r", "R", "2026-04-05", -100),
      ]);
      // Refund excluded: 3 payments -> monthly -> likely recurring
      expect(p.status).toBe("likely_recurring");
      expect(p.transactionCount).toBe(3);
    });

    it("ignores zero-value transactions", () => {
      const p = analyze([
        tx("1", "z", "Z", "2026-01-05", -100),
        tx("2", "z", "Z", "2026-02-05", 0), // zero, ignored
        tx("3", "z", "Z", "2026-03-05", -100),
        tx("4", "z", "Z", "2026-04-05", -100),
      ]);
      expect(p.status).toBe("likely_recurring");
      expect(p.transactionCount).toBe(3);
    });

    it("treats an all-refund merchant as insufficient data", () => {
      const p = analyze([
        tx("1", "r", "R", "2026-01-05", 100),
        tx("2", "r", "R", "2026-02-05", 100),
      ]);
      expect(p.status).toBe("insufficient_data");
      expect(p.transactionCount).toBe(0);
    });
  });

  describe("duplicates", () => {
    it("does not count an exact duplicate (same date, same amount) twice", () => {
      const p = analyze([
        tx("1", "d", "D", "2026-01-05", -100),
        tx("2", "d", "D", "2026-02-05", -100),
        tx("3", "d", "D", "2026-03-05", -100),
        tx("4", "d", "D", "2026-03-05", -100), // duplicate
      ]);
      expect(p.transactionCount).toBe(3);
    });
  });

  describe("grouping and isolation", () => {
    it("never combines transactions from different merchants", () => {
      const rows = [
        tx("1", "adobe", "Adobe", "2026-01-05", -1499),
        tx("2", "adobe", "Adobe", "2026-02-05", -1499),
        tx("3", "slack", "Slack", "2026-01-10", -8),
        tx("4", "slack", "Slack", "2026-02-10", -8),
      ];
      const result = detectRecurring(rows);
      expect(result.patterns.size).toBe(2);
      const adobe = result.patterns.get("adobe");
      const slack = result.patterns.get("slack");
      expect(adobe?.typicalAmount).toBe(1499);
      expect(slack?.typicalAmount).toBe(8);
    });

    it("detects recurring behavior for a non-software merchant (e.g. rent)", () => {
      const p = analyze([
        tx("1", "landlord", "Landlord", "2026-01-01", -20000),
        tx("2", "landlord", "Landlord", "2026-02-01", -20000),
        tx("3", "landlord", "Landlord", "2026-03-01", -20000),
        tx("4", "landlord", "Landlord", "2026-04-01", -20000),
      ]);
      // Behavioral recurrence detected; nothing here claims it's SaaS.
      expect(p.status).toBe("likely_recurring");
      expect(p.interval).toBe("monthly");
    });
  });

  describe("summary", () => {
    it("counts by merchant identity", () => {
      const rows = [
        // adobe: likely recurring monthly (4)
        tx("1", "adobe", "Adobe", "2026-01-05", -1499),
        tx("2", "adobe", "Adobe", "2026-02-05", -1499),
        tx("3", "adobe", "Adobe", "2026-03-05", -1499),
        tx("4", "adobe", "Adobe", "2026-04-05", -1499),
        // slack: 1 payment -> insufficient
        tx("5", "slack", "Slack", "2026-01-05", -8),
        // shop: irregular -> not_recurring
        tx("6", "shop", "Shop", "2026-01-10", -30),
        tx("7", "shop", "Shop", "2026-03-20", -60),
      ];
      const result = detectRecurring(rows);
      const s = result.summary;
      expect(s.totalAnalyzed).toBe(3);
      expect(s.likelyRecurringCount).toBe(1);
      expect(s.insufficientDataCount).toBe(1);
      expect(s.notRecurringCount).toBe(1);
      expect(s.possiblyRecurringCount).toBe(0);
    });
  });

  describe("determinism", () => {
    it("produces identical output for identical input", () => {
      const rows = [
        tx("1", "adobe", "Adobe", "2026-01-05", -1499),
        tx("2", "adobe", "Adobe", "2026-02-05", -1499),
        tx("3", "adobe", "Adobe", "2026-03-05", -1499),
      ];
      expect(analyzeMerchant(rows)).toEqual(analyzeMerchant(rows));
    });
  });

  describe("no mutation", () => {
    it("does not mutate the input transactions", () => {
      const rows = [
        tx("1", "adobe", "Adobe", "2026-01-05", -1499),
        tx("2", "adobe", "Adobe", "2026-02-05", -1499),
        tx("3", "adobe", "Adobe", "2026-03-05", -1499),
      ];
      const snapshot = JSON.stringify(rows);
      analyzeMerchant(rows);
      expect(JSON.stringify(rows)).toBe(snapshot);
    });
  });
});

describe("interval classification", () => {
  it("classifies 28-31 day gaps as monthly", () => {
    expect(classifyGap(28)).toBe("monthly");
    expect(classifyGap(30)).toBe("monthly");
    expect(classifyGap(31)).toBe("monthly");
  });
  it("classifies weekly and annual correctly", () => {
    expect(classifyGap(7)).toBe("weekly");
    expect(classifyGap(365)).toBe("annual");
  });
  it("returns null for an unrecognized gap", () => {
    expect(classifyGap(45)).toBeNull();
  });
});

describe("performance", () => {
  it("handles a large dataset within a reasonable time (near O(n))", () => {
    const rows: NormalizedTransactionWithMerchant[] = [];
    const now = Date.parse("2026-01-01");
    const MONTH_MS = 30 * 86400000;
    // 2000 merchants x 12 monthly payments = 24000 transactions.
    for (let m = 0; m < 2000; m++) {
      const key = `merchant_${m}`;
      for (let mo = 0; mo < 12; mo++) {
        const date = new Date(now + mo * MONTH_MS).toISOString().slice(0, 10);
        rows.push(tx(`${m}_${mo}`, key, key, date, -100));
      }
    }
    const start = Date.now();
    const result = detectRecurring(rows);
    const elapsed = Date.now() - start;
    expect(result.patterns.size).toBe(2000);
    expect(result.summary.likelyRecurringCount).toBe(2000);
    expect(elapsed).toBeLessThan(2000);
  });
});