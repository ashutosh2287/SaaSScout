import { describe, expect, it } from "vitest";
import type {
  MerchantIdentity,
  NormalizedTransactionWithMerchant,
} from "../merchant/types";
import { analyzeMerchant } from "./detect";
import { amountStability, detectPriceChange } from "./amounts";
import type { RecurringPattern } from "./types";

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

function tx(
  id: string,
  date: string,
  amount: number,
): NormalizedTransactionWithMerchant {
  return {
    id,
    date,
    description: "M",
    amount: -Math.abs(amount),
    sourceRow: 0,
    merchant: identity("M", "m"),
  };
}

function pay(dates: string[], amounts: number[]): NormalizedTransactionWithMerchant[] {
  return dates.map((d, i) => tx(String(i), d, amounts[i % amounts.length]));
}

function evidenceTypes(p: RecurringPattern): string[] {
  return p.evidence.map((e) => e.type);
}

// Consecutive months (approx) from a starting ISO date.
function monthlyDates(start: string, count: number): string[] {
  const base = Date.parse(start);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(base + i * 30 * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

const STABLE_AMOUNT = 1999;

describe("Step 15 recurring intelligence — amount stability", () => {
  it("E: exact stable amounts are highly_stable", () => {
    expect(amountStability([1999, 1999, 1999, 1999])).toBe("highly_stable");
  });

  it("E: tiny rounding differences stay highly_stable", () => {
    expect(amountStability([1999, 2000, 1999, 1998])).toBe("highly_stable");
  });

  it("F: small real variation is moderately_stable, not variable", () => {
    expect(amountStability([19.99, 20.99, 19.99, 20.99])).toBe("moderately_stable");
  });

  it("G: big scatter is variable", () => {
    expect(amountStability([19.99, 49.99, 12.99, 89.99])).toBe("variable");
  });

  it("insufficient_evidence when fewer than 2 amounts", () => {
    expect(amountStability([])).toBe("insufficient_evidence");
    expect(amountStability([1999])).toBe("insufficient_evidence");
  });
});

describe("Step 15 recurring intelligence — price change", () => {
  it("H: detects a clean price increase", () => {
    expect(detectPriceChange([49.99, 49.99, 59.99, 59.99])).toEqual({ from: 49.99, to: 59.99 });
  });

  it("detects a price decrease", () => {
    expect(detectPriceChange([59.99, 59.99, 49.99, 49.99])).toEqual({ from: 59.99, to: 49.99 });
  });

  it("does not report a price change for small alternation", () => {
    expect(detectPriceChange([19.99, 20.99, 19.99, 20.99])).toBeNull();
  });

  it("does not report a price change for a single outlier", () => {
    expect(detectPriceChange([1499, 1499, 5999, 1499])).toBeNull();
  });
});

describe("Step 15 recurring intelligence — patterns", () => {
  it("A: strong monthly pattern, 12 stable payments", () => {
    const p = analyzeMerchant(pay(monthlyDates("2025-01-15", 12), [STABLE_AMOUNT]));
    expect(p.status).toBe("likely_recurring");
    expect(p.interval).toBe("monthly");
    expect(p.confidence).toBe("high");
    expect(p.strength).toBe("strong");
    expect(p.amountProfile).toBe("highly_stable");
    expect(p.intervalConsistency).toBe(1);
    expect(p.gapCount).toBe(0);
    expect(p.patternSpanMonths).toBeGreaterThanOrEqual(11);
    expect(evidenceTypes(p)).toContain("monthly_pattern");
    expect(evidenceTypes(p)).toContain("payment_history");
    expect(p.evidence.some((e) => e.type === "payment_history" && /12 payments were observed/.test(e.message))).toBe(true);
  });

  it("B: strong annual pattern across multiple years", () => {
    const p = analyzeMerchant([
      tx("1", "2023-01-10", 2000),
      tx("2", "2024-01-10", 2000),
      tx("3", "2025-01-10", 2000),
      tx("4", "2026-01-10", 2000),
    ]);
    expect(p.interval).toBe("annual");
    expect(p.status).toBe("likely_recurring");
    expect(p.strength).toBe("strong");
    expect(p.patternSpanMonths).toBeGreaterThanOrEqual(36);
    expect(evidenceTypes(p)).toContain("annual_pattern");
  });

  it("C: quarterly pattern", () => {
    const p = analyzeMerchant([
      tx("1", "2026-01-10", 500),
      tx("2", "2026-04-10", 500),
      tx("3", "2026-07-10", 500),
      tx("4", "2026-10-10", 500),
    ]);
    expect(p.status).toBe("likely_recurring");
    expect(p.interval).toBe("quarterly");
    expect(evidenceTypes(p)).toContain("quarterly_pattern");
    expect(p.intervalConsistency).toBe(1);
  });

  it("D: weekly pattern stays capped at medium confidence", () => {
    const p = analyzeMerchant(pay(["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"], [30]));
    expect(p.interval).toBe("weekly");
    expect(p.status).toBe("likely_recurring");
    expect(p.confidence).toBe("medium");
    expect(evidenceTypes(p)).toContain("weekly_pattern");
  });

  it("F: moderate amount variation yields moderately_stable profile", () => {
    const p = analyzeMerchant(pay(monthlyDates("2025-01-15", 12), [19.99, 20.99]));
    expect(p.amountProfile).toBe("moderately_stable");
    expect(evidenceTypes(p)).not.toContain("amount_variation");
    expect(p.strength).toBe("strong");
  });

  it("G: major amount variation yields variable profile and weak strength", () => {
    const p = analyzeMerchant(pay(monthlyDates("2026-01-15", 4), [19.99, 49.99, 12.99, 89.99]));
    expect(p.amountProfile).toBe("variable");
    expect(p.strength).toBe("weak");
    expect(evidenceTypes(p)).toContain("amount_variation");
  });

  it("H: price increase is surfaced as structured evidence, still recurring", () => {
    const p = analyzeMerchant(pay(monthlyDates("2026-01-15", 4), [49.99, 49.99, 59.99, 59.99]));
    expect(p.priceChange).toEqual({ from: 49.99, to: 59.99 });
    expect(evidenceTypes(p)).toContain("price_change");
    expect(p.status).toBe("likely_recurring");
    expect(p.amountProfile).toBe("moderately_stable");
  });

  it("I: a missing month weakens strength and emits a gap", () => {
    const p = analyzeMerchant([
      tx("1", "2026-01-15", 100),
      tx("2", "2026-02-15", 100),
      tx("3", "2026-03-15", 100),
      tx("4", "2026-04-15", 100),
      tx("5", "2026-06-15", 100),
    ]);
    expect(p.interval).toBe("monthly");
    expect(p.gapCount).toBe(1);
    expect(evidenceTypes(p)).toContain("payment_gap");
    expect(p.strength).toBe("moderate"); // pattern present but interrupted
  });

  it("J: irregular intervals are not recurring regardless of count", () => {
    const p = analyzeMerchant([
      tx("1", "2026-01-10", 100),
      tx("2", "2026-03-20", 100),
      tx("3", "2026-08-05", 100),
      tx("4", "2026-12-25", 100),
    ]);
    expect(p.status).toBe("not_recurring");
    expect(p.strength).toBe("weak");
  });

  it("N: long history with irregular intervals stays weak (not virtuous by age)", () => {
    const p = analyzeMerchant(pay(
      ["2024-01-10", "2024-05-20", "2024-09-15", "2025-02-05", "2025-07-25", "2025-11-30", "2026-03-10", "2026-08-20", "2026-12-05", "2027-04-15", "2027-09-01", "2027-12-20"],
      [100],
    ));
    expect(p.status).toBe("not_recurring");
    expect(p.strength).toBe("weak");
  });

  it("K: a single payment is insufficient", () => {
    const p = analyzeMerchant([tx("1", "2026-01-05", 100)]);
    expect(p.status).toBe("insufficient_data");
    expect(p.strength).toBe("insufficient");
    expect(p.amountProfile).toBe("insufficient_evidence");
  });

  it("L: two matching payments are weak and clearly finite", () => {
    const p = analyzeMerchant([
      tx("1", "2026-01-05", 100),
      tx("2", "2026-02-05", 100),
    ]);
    expect(p.status).toBe("possibly_recurring");
    expect(p.strength).toBe("weak");
    expect(p.evidence.some((e) => e.type === "payment_history" && /Only 2 payments/.test(e.message))).toBe(true);
  });

  it("M: three stable payments are not 'strong' despite being likely", () => {
    const p = analyzeMerchant([
      tx("1", "2026-01-05", 100),
      tx("2", "2026-02-05", 100),
      tx("3", "2026-03-05", 100),
    ]);
    expect(p.status).toBe("likely_recurring");
    expect(p.strength).toBe("moderate");
    expect(p.strength).not.toBe("strong");
  });

  it("O: refunds (positive amounts) never count as payments", () => {
    const p = analyzeMerchant([
      { ...tx("1", "2026-01-05", 100), amount: -100 },
      { ...tx("2", "2026-01-20", 100), amount: 100 }, // refund (credit), ignored
      { ...tx("3", "2026-02-05", 100), amount: -100 },
    ]);
    expect(p.transactionCount).toBe(2);
    expect(p.status).toBe("possibly_recurring");
    expect(p.strength).toBe("weak");
  });

  it("P: zero-value transactions are ignored", () => {
    const p = analyzeMerchant([
      { ...tx("1", "2026-01-05", 100), amount: -100 },
      { ...tx("2", "2026-02-05", 0), amount: 0 },
      { ...tx("3", "2026-03-05", 100), amount: -100 },
    ]);
    expect(p.transactionCount).toBe(2);
  });

  it("Q: exact duplicate payments are counted once", () => {
    const p = analyzeMerchant([
      tx("1", "2026-01-05", 100),
      tx("2", "2026-02-05", 100),
      tx("3", "2026-03-05", 100),
      tx("4", "2026-03-05", 100),
    ]);
    expect(p.transactionCount).toBe(3);
  });

  it("R: a payment with a null date is excluded from the pattern", () => {
    const p = analyzeMerchant([
      tx("1", "2026-01-05", 100),
      { ...tx("2", "2026-02-05", 100), date: null }, // unresolved date
      tx("3", "2026-03-05", 100),
    ]);
    expect(p.transactionCount).toBe(2);
  });

  it("S: output is deterministic and does not mutate input", () => {
    const rows = pay(monthlyDates("2026-01-05", 6), [100, 99.99]);
    const snapshot = JSON.stringify(rows);
    const a = analyzeMerchant(rows);
    const b = analyzeMerchant(rows);
    expect(a).toEqual(b);
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
});
