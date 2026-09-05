/**
 * STEP 36 — performance-resilience regression.
 *
 * Guards the confirmed O(n^2)-class hot spots against regressions, and locks
 * the *semantics* of the faster algorithms:
 *
 *  1. detectPriceChange rewrite vs a faithful O(n^2) reference oracle on
 *     thousands of deterministic inputs (covers the real risk: a "fast"
 *     rewrite that changed the answer).
 *  2. pathological single-merchant recurring detection stays bounded (was 22s
 *     at 10k payments, 154s at 25k before STEP 36).
 *  3. groupMerchants with many distinct descriptions per merchant stays
 *     bounded (was 24s at 40k rows before STEP 36).
 *
 * Budgets are deliberately very generous: they only fail on quadratic
 * blowups, never on slow machines.
 */
import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import {
  AMOUNT_RELATIVE_TOLERANCE,
  PRICE_CHANGE_MIN_RELATIVE,
} from "./recurring/constants";
import { amountStability, detectPriceChange } from "./recurring/amounts";
import type { RecurringPriceChange } from "./recurring/types";
import { analyzeMerchant, detectRecurring } from "./recurring";
import { groupMerchants, normalizeMerchants } from "./merchant";
import type { NormalizedTransactionWithMerchant } from "./merchant/types";
import type { NormalizedTransaction } from "./parse/types";

// ---- 1. Oracle equivalence for detectPriceChange ----

function medianRef(amounts: number[]): number | null {
  if (amounts.length === 0) return null;
  const sorted = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// Faithful copy of the pre-STEP-36 implementation (the O(n^2 log n) scan).
function referenceDetectPriceChange(amounts: number[]): RecurringPriceChange | null {
  const n = amounts.length;
  if (n < 3) return null;
  for (let k = 1; k < n; k++) {
    const a = amounts.slice(0, k);
    const b = amounts.slice(k);
    const medA = medianRef(a);
    const medB = medianRef(b);
    if (medA === null || medB === null || medA === 0) continue;
    const jump = Math.abs(medB - medA) / Math.abs(medA);
    if (jump < PRICE_CHANGE_MIN_RELATIVE) continue;
    if (!refLevelStable(a, medA) || !refLevelStable(b, medB)) continue;
    return { from: medA, to: medB };
  }
  return null;
}

function refLevelStable(amounts: number[], levelMedian: number): boolean {
  if (levelMedian === 0) return false;
  for (const a of amounts) {
    if (Math.abs(a - levelMedian) / Math.abs(levelMedian) > AMOUNT_RELATIVE_TOLERANCE) {
      return false;
    }
  }
  return true;
}

// Deterministic pseudo-random generator (mulberry32) so the corpus is
// reproducible across runs and machines.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomAmounts(seed: number, n: number): number[] {
  const rand = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(1 + Math.round(rand() * 2000) / 100);
  return out;
}

// Inject a clean step: first `split` values around levelA, rest around levelB.
function stepAmounts(split: number, n: number, levelA: number, levelB: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i < split ? levelA : levelB);
  return out;
}

function assertSame(a: RecurringPriceChange | null, b: RecurringPriceChange | null): void {
  if (a === null || b === null) {
    expect(a).toBe(b);
    return;
  }
  expect(a).toEqual(b);
}

describe("detectPriceChange rewrite matches the O(n^2) reference", () => {
  it("EXACT semantics on thousands of deterministic random inputs (n<=40)", () => {
    let checked = 0;
    for (let seed = 1; seed <= 500; seed++) {
      for (const n of [3, 4, 5, 7, 10, 15, 20, 30, 40]) {
        const amounts = randomAmounts(seed, n);
        assertSame(detectPriceChange(amounts), referenceDetectPriceChange(amounts));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(4000);
  });

  it("EXACT semantics for injected clean steps at many split points", () => {
    for (const split of [1, 2, 3, 5, 10]) {
      for (const n of [split + 1, split + 2, split + 5, split + 12]) {
        for (const [a, b] of [
          [10, 15],
          [49.99, 59.99],
          [1, 200],
          [100, 30],
        ]) {
          const amounts = stepAmounts(split, n, a, b);
          assertSame(detectPriceChange(amounts), referenceDetectPriceChange(amounts));
        }
      }
    }
  });

  it("clearly detects a clean step buried at the end of 10,000 payments", () => {
    const amounts = [...new Array(9900).fill(50), ...new Array(100).fill(62.5)];
    expect(detectPriceChange(amounts)).toEqual({ from: 50, to: 62.5 });
  });

  it("returns null on a 10k random array and a 10k stable array", () => {
    expect(detectPriceChange(randomAmounts(42, 10000))).toBeNull();
    expect(detectPriceChange(new Array(10000).fill(50))).toBeNull();
  });
});

// ---- 2. Pathological single-merchant recurring detection stays bounded ----

function merchantRows(count: number): NormalizedTransactionWithMerchant[] {
  const rows: NormalizedTransactionWithMerchant[] = [];
  for (let i = 0; i < count; i++) {
    const day = (i % 28) + 1;
    const month = (Math.floor(i / 30) % 12) + 1;
    const date = `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const raw = `AMAZON *MARKETPLACE ${String(i).padStart(10, "0")} ORDER`;
    rows.push({
      id: `t${i}`,
      date,
      description: raw,
      amount: -(5 + ((i * 7919) % 50000)),
      sourceRow: i,
      merchant: {
        canonicalName: "Amazon",
        normalizedKey: "amazon",
        source: "deterministic",
        confidence: "medium",
        rawDescription: raw,
        cleanedDescription: raw,
      },
    });
  }
  return rows;
}

describe("STEP 36 — recurring detection large-input bounded complexity", () => {
  it("analyzes a 10k-payment single merchant quickly and deterministically", () => {
    const before = performance.now();
    const a = analyzeMerchant(merchantRows(10_000));
    const elapsed = performance.now() - before;
    // Pre-fix this was ~22s (quadratic detectPriceChange); the guard only
    // trips on quadratic regressions, never on slow machines.
    expect(elapsed).toBeLessThan(10_000);
    const b = analyzeMerchant(merchantRows(10_000));
    expect(b).toEqual(a);
    expect(a.transactionCount).toBeLessThanOrEqual(10_000);
  });

  it("amountStability stays coherent on pathological scale", () => {
    expect(amountStability(Array.from({ length: 10_000 }, (_, i) => 10 + (i % 997)))).toBe("variable");
  });

  it("runs the full recurring detector over 25k skewed rows without explosion", () => {
    const rows = merchantRows(25_000);
    const before = performance.now();
    const { transactions } = normalizeMerchants(rows);
    const result = detectRecurring(transactions);
    const elapsed = performance.now() - before;
    expect(elapsed).toBeLessThan(10_000);
    expect(result.patterns.size).toBeGreaterThanOrEqual(1);
  });
});

// ---- 3. groupMerchants bounded with many distinct descriptions ----

describe("STEP 36 — groupMerchants distinct-description bounded complexity", () => {
  it("groups 40k distinct descriptions of one merchant quickly, dedup preserved", () => {
    const rows = merchantRows(40_000);
    const before = performance.now();
    const groups = groupMerchants(rows);
    const elapsed = performance.now() - before;
    // Pre-fix this was ~24s; the guard only trips on quadratic regressions.
    expect(elapsed).toBeLessThan(10_000);
    const g = groups.find((x) => x.normalizedKey === "amazon")!;
    expect(g.transactionCount).toBe(40_000);
    expect(g.distinctRawDescriptions).toHaveLength(40_000);
  });

  it("keeps the distinctRawDescriptions contract (insertion order, no dupes)", () => {
    const rows = merchantRows(5).concat(merchantRows(3));
    const [g] = groupMerchants(rows);
    expect(g.distinctRawDescriptions).toHaveLength(5);
    expect(g.transactionCount).toBe(8);
    expect(new Set(g.distinctRawDescriptions).size).toBe(5);
  });
});

// ---- 4. Transaction-level pipeline equivalence across the optimized path ----

function txn(id: string, date: string | null, description: string, amount: number, sourceRow: number): NormalizedTransaction {
  return { id, date, description, amount, sourceRow };
}

describe("STEP 36 — optimized path analytical invariants", () => {
  it("merchant grouping is deterministic: reversed input yields same counts and description SET (first-seen order legitimately varies)", () => {
    const rowsA = groupMerchants(merchantRows(50));
    const rowsB = groupMerchants([...merchantRows(50)].reverse());
    expect(JSON.stringify(rowsB.map((g) => g.normalizedKey))).toBe(
      JSON.stringify(rowsA.map((g) => g.normalizedKey)),
    );
    for (const g of rowsB) {
      const match = rowsA.find((x) => x.normalizedKey === g.normalizedKey)!;
      expect(g.transactionCount).toBe(match.transactionCount);
      expect(new Set(g.distinctRawDescriptions)).toEqual(new Set(match.distinctRawDescriptions));
    }
  });

  it("recurring output for a mixed dataset equals its reference behavior", () => {
    // Stable monthly merchant + variable merchant + late step: the oracle
    // semantics must survive in analyzeMerchant's result.
    const rows: NormalizedTransaction[] = [];
    let i = 0;
    for (let m = 1; m <= 12; m++) {
      rows.push(txn(`s${m}`, `2025-${String(m).padStart(2, "0")}-05`, "SLACK", -12, i++));
      if (m <= 6) rows.push(txn(`v${m}`, `2025-${String(m).padStart(2, "0")}-10`, "AWS AMAZON", -(m * 37), i++));
    }
    rows.push(txn("step1", "2025-01-20", "FIGMA", -19, i++));
    rows.push(txn("step2", "2025-02-20", "FIGMA", -19, i++));
    rows.push(txn("step3", "2025-03-20", "FIGMA", -19, i++));
    rows.push(txn("step4", "2025-04-20", "FIGMA", -25, i++));
    rows.push(txn("step5", "2025-05-20", "FIGMA", -25, i++));
    const { transactions } = normalizeMerchants(rows);
    const r = detectRecurring(transactions);
    const figma = r.patterns.get("figma")!;
    expect(figma.priceChange).toEqual({ from: 19, to: 25 });
    const slack = r.patterns.get("slack")!;
    expect(slack.status).toBe("likely_recurring");
    expect(slack.interval).toBe("monthly");
  });
});

// ---- 5. Malformed / hostile large inputs stay bounded and don't crash ----

describe("STEP 36 — malformed large inputs", () => {
  it("handles a huge set of null-date / zero-amount / refund transactions quickly", () => {
    const rows: NormalizedTransactionWithMerchant[] = [];
    const raw = "ACME BILLING";
    for (let i = 0; i < 20_000; i++) {
      // Null dates and non-payment amounts must not feed the price-change scan.
      rows.push({
        id: `t${i}`,
        date: i % 3 === 0 ? null : "2025-01-05",
        description: raw,
        amount: i % 2 === 0 ? 0 : i % 5 === 0 ? 900 : -10,
        sourceRow: i,
        merchant: {
          canonicalName: "ACME Billing",
          normalizedKey: "acme-billing",
          source: "deterministic",
          confidence: "medium",
          rawDescription: raw,
          cleanedDescription: raw,
        },
      });
    }
    const before = performance.now();
    const r = analyzeMerchant(rows);
    const elapsed = performance.now() - before;
    expect(elapsed).toBeLessThan(5_000);
    // Only the negative-amount, dated entries count as payments.
    expect(r.transactionCount).toBeLessThanOrEqual(20_000);
    expect(r.transactionCount).toBeGreaterThan(0);
  });

  it("handles a 25k merchant set each with a single transaction (fan-out)", () => {
  // The cleaner strips trailing digits (order numbers), so merchant-unique
  // tokens must be embedded mid-description as letters.
  const encode = (n: number): string => {
    const az = "abcdefghijklmnopqrstuvwxyz";
    let out = "";
    let v = n;
    do {
      out = az[v % 26] + out;
      v = Math.floor(v / 26) - 1;
    } while (v >= 0);
    return out.length >= 2 ? out : out + "q";
  };
  const seen = new Set<string>();
  const raw = Array.from({ length: 25_000 }, (_, i) => {
    let code = encode(i);
    while (seen.has(code)) code += "z";
    seen.add(code);
    return `MERCHANT ${code} SERVICES`;
  });
  const { transactions } = normalizeMerchants(
    raw.map((d, i) => txn(`t${i}`, `2025-01-${String((i % 28) + 1).padStart(2, "0")}`, d, -(5 + (i % 50)), i)),
  );
  expect(transactions.length).toBe(25_000);
  const distinctKeys = new Set(transactions.map((t) => t.merchant.normalizedKey));
  expect(distinctKeys.size).toBe(25_000);
  const before = performance.now();
  const groups = groupMerchants(transactions);
  const elapsed = performance.now() - before;
  expect(elapsed).toBeLessThan(10_000);
  expect(groups.length).toBe(25_000);
});

  it("detectPriceChange is stable on pathological adversarial arrays", () => {
    // Many-zeros, huge dynamic range, and a late step at the very end.
    const adversarial = [
      ...new Array(5_000).fill(1e-7),
      ...new Array(5_000).fill(1e9),
      ...new Array(100).fill(12345.678),
    ];
    const r = detectPriceChange(adversarial);
    // Must not throw or loop; exact value is a product of the stable semantics.
    expect(r).not.toBeUndefined();
    expect(r === null || (r.from > 0 && r.to > 0)).toBe(true);
  });

  it("does not throw on amounts containing NaN/Infinity-sized values", () => {
    const withJunk = [...new Array(1_000).fill(50)];
    withJunk[500] = Number.NaN;
    withJunk[501] = Number.POSITIVE_INFINITY;
    // Must not throw (it will almost certainly report no clean change).
    expect(() => detectPriceChange(withJunk)).not.toThrow();
  });
});