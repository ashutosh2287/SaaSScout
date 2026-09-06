import { describe, expect, it } from "vitest";
import { normalizeMerchants } from "../merchant";
import { classifyMerchants } from "../classification";
import { detectRecurring } from "../recurring";
import type { MerchantCategory } from "../classification/types";
import {
  BENCHMARK_AMBIGUOUS_KEYS,
  BENCHMARK_HARD_KEYS,
  BENCHMARK_NON_SOFTWARE_EXPECTED,
  BENCHMARK_SOFTWARE_EXPECTED,
  BENCHMARK_TXNS,
} from "./dataset";

// Phase 17 — realistic benchmark measurement.
//
// Defines a denominator and reports honest classification quality on a
// synthetic 3-month statement. Never claims "accuracy" without the benchmark it
// was measured against. Results are asserted as floors so future regressions
// are caught, and the per-case lists are printed to the test output for review.

const SOFTWARE_CATEGORIES: MerchantCategory[] = ["likely_saas", "likely_software"];

function run() {
  const merchantResult = normalizeMerchants(BENCHMARK_TXNS);
  const classified = classifyMerchants(merchantResult.merchants);
  const recurring = detectRecurring(merchantResult.transactions);
  return { merchantResult, classified, recurring };
}

describe("Phase 17 benchmark", () => {
  const { merchantResult, classified, recurring } = run();
  const byKey = new Map(classified.merchants.map((m) => [m.normalizedKey, m]));

  it("parses/normalizes every transaction without exceptions", () => {
    expect(merchantResult.transactions).toHaveLength(BENCHMARK_TXNS.length);
    expect(merchantResult.resolvedCount + merchantResult.unresolvedCount).toBe(BENCHMARK_TXNS.length);
  });

  it("recovers every expected software merchant with a software label (recall)", () => {
    const missing: string[] = [];
    for (const key of BENCHMARK_SOFTWARE_EXPECTED) {
      const m = byKey.get(key);
      if (!m || !SOFTWARE_CATEGORIES.includes(m.classification.category)) {
        missing.push(`${key} -> ${m?.classification.category ?? "MISSING"}`);
      }
    }
    const recall = 1 - missing.length / BENCHMARK_SOFTWARE_EXPECTED.length;
    // allow "amazon web services" hard case to reduce recall by at most 1
    expect(missing).toEqual([]);
    expect(recall).toBe(1);
  });

  it("keeps non-software merchants classified as not_software", () => {
    const mislabeled: string[] = [];
    for (const key of BENCHMARK_NON_SOFTWARE_EXPECTED) {
      const m = byKey.get(key);
      if (!m || m.classification.category !== "not_software") {
        mislabeled.push(`${key} -> ${m?.classification.category ?? "MISSING"}`);
      }
    }
    expect(mislabeled).toEqual([]);
  });

  it("keeps ambiguous merchants unknown (no fabricated software label)", () => {
    const mislabeled: string[] = [];
    for (const key of BENCHMARK_AMBIGUOUS_KEYS) {
      const m = byKey.get(key);
      if (!m || m.classification.category !== "unknown") {
        mislabeled.push(`${key} -> ${m?.classification.category ?? "MISSING"}`);
      }
    }
    expect(mislabeled).toEqual([]);
  });

  it("reports measured precision with false positives enumerated", () => {
    const softwarePredicted = classified.merchants.filter((m) =>
      SOFTWARE_CATEGORIES.includes(m.classification.category),
    );
    const expected = new Set(BENCHMARK_SOFTWARE_EXPECTED);
    const hard = new Set(BENCHMARK_HARD_KEYS);
    const falsePositives = softwarePredicted.filter(
      (m) => !expected.has(m.normalizedKey) && !hard.has(m.normalizedKey),
    );
    const precision =
      (softwarePredicted.length - falsePositives.length) / softwarePredicted.length;
    // Print the enumeration for the report.
    console.log("✓ software predicted:", softwarePredicted.map((m) => m.normalizedKey).sort().join(", "));
    console.log("✓ false positives:", falsePositives.length === 0 ? "none" : falsePositives.map((m) => `${m.normalizedKey} (${m.classification.category})`).join(", "));
    expect(falsePositives).toEqual([]);
    expect(precision).toBe(1);
  });

  it("detects monthly recurring patterns for the software merchants", () => {
    const recurringKeys = new Set<string>();
    for (const [key, pattern] of recurring.patterns) {
      const status = pattern.status;
      if (status === "likely_recurring") recurringKeys.add(key);
    }
    // AWS has 3 monthly occurrences; every expected vendor is monthly.
    for (const key of BENCHMARK_SOFTWARE_EXPECTED) {
      if (!byKey.has(key)) continue; // missed merchant can't be recurring
      expect(recurringKeys.has(key), `${key} should be likely_recurring`).toBe(true);
    }
  });

  it("does not invent software spend for merchants without software evidence", () => {
    const classifiedKeys = new Set(classified.merchants.map((m) => m.normalizedKey));
    const allowed = new Set([
      ...BENCHMARK_SOFTWARE_EXPECTED,
      ...BENCHMARK_NON_SOFTWARE_EXPECTED,
      ...BENCHMARK_AMBIGUOUS_KEYS,
      ...BENCHMARK_HARD_KEYS,
    ]);
    const unaccounted = [...classifiedKeys].filter((k) => !allowed.has(k));
    console.log("✓ all merchants accounted for by ground truth");
    expect(unaccounted).toEqual([]);
  });

  it("is deterministic across identical inputs", () => {
    const a = normalizeMerchants(BENCHMARK_TXNS);
    const b = normalizeMerchants(BENCHMARK_TXNS);
    expect(JSON.stringify(a.merchants)).toBe(JSON.stringify(b.merchants));
  });
});