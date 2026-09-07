import { describe, expect, it } from "vitest";
import type { ComparisonFinding, ComparisonKind } from "./types";
import { formatSummary, summarizeFindings } from "./summary";
import { buildStep24Scenario, rowsToTransactions, splitWindows } from "../step24/scenario";
import { snapshotFor, runCompare } from "../betatest/helpers";

// Step 25 — comparison summary band. Pure-model and presentation tests. The
// formatter is exercised with exact string assertions; the scenario integration
// pins the aggregate to instrumented ground truth. NO component test harness is
// installed, so the JSX stays a thin shim over these functions and rendering is
// documented by inspection (report section Accessible / Responsive).

function mk(kind: ComparisonKind, name: string, yearlyDelta: number | null): ComparisonFinding {
  return {
    kind,
    merchantKey: name,
    merchantName: name,
    confidence: "high",
    evidence: [],
    impact: { monthlyDelta: null, yearlyDelta },
  };
}

function measureScenario() {
  const txns = rowsToTransactions(buildStep24Scenario().rows);
  const { baseline, current } = splitWindows(txns);
  const bp = snapshotFor(baseline, "baseline.csv");
  const cp = snapshotFor(current, "current.csv");
  return runCompare(bp.report, cp.report).findings;
}

describe("step25 / summarizeFindings — model", () => {
  it("A: normal mixed findings aggregate to exact counts", () => {
    const findings = measureScenario();
    const s = summarizeFindings(findings);
    // Step 26 — 2 intra-period `possible_overlap` findings are added to the
    // original 13 (microsoft+zoom in `communication`, adobe+figma in `design`).
    // They carry null impact, so all delta-based counts are untouched; the
    // total count grows by 2.
    expect(s.findingCount).toBe(15);
    expect(s.increaseCount).toBe(7);
    expect(s.decreaseCount).toBe(3);
    expect(s.newRecurringCount).toBe(2);
    expect(s.endedRecurringCount).toBe(2);
    expect(s.netAnnualizedDelta).toBeCloseTo(-6841.722222, 2);
  });

  it("B: empty findings collapse to an honest zero-state model", () => {
    const s = summarizeFindings([]);
    expect(s).toEqual({
      findingCount: 0,
      netAnnualizedDelta: null,
      increaseCount: 0,
      decreaseCount: 0,
      newRecurringCount: 0,
      endedRecurringCount: 0,
    });
  });

  it("C: all-positive deltas sum correctly and count as increases", () => {
    const f = [mk("price_increase", "a", 100), mk("new_recurring", "b", 50), mk("price_increase", "c", 25)];
    const s = summarizeFindings(f);
    expect(s.netAnnualizedDelta).toBe(175);
    expect(s.increaseCount).toBe(3);
    expect(s.decreaseCount).toBe(0);
    expect(s.newRecurringCount).toBe(1);
    expect(s.endedRecurringCount).toBe(0);
  });

  it("D: all-negative deltas sum correctly and count as decreases", () => {
    const f = [mk("ended_recurring", "a", -100), mk("price_decrease", "b", -25)];
    const s = summarizeFindings(f);
    expect(s.netAnnualizedDelta).toBe(-125);
    expect(s.increaseCount).toBe(0);
    expect(s.decreaseCount).toBe(2);
    expect(s.endedRecurringCount).toBe(1);
  });

  it("E: positive + negative cancellation yields an exact zero net", () => {
    const s = summarizeFindings([mk("price_increase", "a", 100), mk("price_decrease", "b", -100)]);
    expect(s.netAnnualizedDelta).toBe(0);
    expect(s.increaseCount).toBe(1);
    expect(s.decreaseCount).toBe(1);
  });

  it("F: an exact zero delta is valid but counts in neither direction", () => {
    const s = summarizeFindings([mk("frequency_change", "a", 0)]);
    expect(s.netAnnualizedDelta).toBe(0);
    expect(s.increaseCount).toBe(0);
    expect(s.decreaseCount).toBe(0);
  });

  it("G: null deltas are excluded and never poison the total", () => {
    const s = summarizeFindings([mk("pattern_irregular", "a", null), mk("price_increase", "b", 100)]);
    expect(s.netAnnualizedDelta).toBe(100);
    expect(s.increaseCount).toBe(1);
    const only = summarizeFindings([mk("pattern_irregular", "a", null), mk("merchant_appeared", "b", null)]);
    expect(only.netAnnualizedDelta).toBeNull();
  });

  it("H/I: NaN and ±Infinity deltas are treated as invalid", () => {
    const s = summarizeFindings([
      mk("price_increase", "nan", NaN),
      mk("price_decrease", "pinf", Infinity),
      mk("price_decrease", "ninf", -Infinity),
      mk("price_increase", "ok", 42),
    ]);
    expect(s.netAnnualizedDelta).toBe(42);
    expect(s.increaseCount).toBe(1);
    expect(s.decreaseCount).toBe(0);
  });

  it("N: same-magnitude findings on both sides of the ledger stay exact", () => {
    const s = summarizeFindings([mk("price_increase", "a", 85.17), mk("price_increase", "b", 85.17), mk("price_decrease", "c", -85.17)]);
    expect(s.netAnnualizedDelta).toBeCloseTo(85.17, 5);
    expect(s.increaseCount).toBe(2);
    expect(s.decreaseCount).toBe(1);
  });

  it("O: large finding counts aggregate exactly and fast (single pass)", () => {
    const n = 25000;
    const f: ComparisonFinding[] = [];
    for (let i = 0; i < n; i++) {
      const d = ((i % 5) - 2) * 10; // -20,-10,0,10,20
      f.push(mk(i % 4 === 0 ? "new_recurring" : "price_increase", `m${i}`, d));
    }
    const t0 = performance.now();
    const s = summarizeFindings(f);
    const ms = performance.now() - t0;
    expect(s.findingCount).toBe(n);
    expect(s.netAnnualizedDelta).toBe(0); // symmetric spread cancels exactly
    console.log(`step25 summarizeFindings perf (ms, n=25k): ${ms.toFixed(3)}`);
    expect(ms).toBeLessThan(50);
  });

  it("P/Q/R: deterministic, immutable, order-preserving", () => {
    const f = [mk("price_increase", "beta", 20), mk("ended_recurring", "alpha", -80), mk("new_recurring", "gamma", 200)];
    const copy = structuredClone(f);
    const a = summarizeFindings(f);
    const b = summarizeFindings(f);
    expect(a).toEqual(b);
    expect(f).toEqual(copy);
    expect(f[0].merchantKey).toBe("beta"); // input order untouched
    const s = summarizeFindings(f);
    expect(s.netAnnualizedDelta).toBe(140);
  });
});

describe("step25 / formatSummary — presentation", () => {
  const S = () => {
    const findings = measureScenario();
    return summarizeFindings(findings);
  };

  it("A: renders the compact band exactly on the measured scenario", () => {
    // 15 = 13 cross-period findings + 2 intra-period possible_overlap findings
    // (null impact, no net contribution). The delta-based segments are
    // unchanged.
    expect(formatSummary(S())).toBe("15 changes · Net −$6841.72/yr · 7 increases · 3 decreases · 2 new · 2 ended");
  });

  it("B: empty findings collapse to a plain '0 changes'", () => {
    expect(formatSummary(summarizeFindings([]))).toBe("0 changes");
  });

  it("singular/plural counts", () => {
    expect(formatSummary(summarizeFindings([mk("price_increase", "a", 5)]))).toBe("1 change · Net +$5.00/yr · 1 increase");
  });

  it("E: a cancelling net renders as $0.00 with no sign", () => {
    expect(formatSummary(summarizeFindings([mk("price_increase", "a", 100), mk("price_decrease", "b", -100)]))).toBe(
      "2 changes · Net $0.00/yr · 1 increase · 1 decrease",
    );
  });

  it("G: all-null deltas omit the net segment rather than fake a number", () => {
    const on = summarizeFindings([mk("pattern_irregular", "a", null), mk("merchant_appeared", "b", null)]);
    expect(formatSummary(on)).toBe("2 changes");
  });

  it("J: honors a recognized currency symbol", () => {
    expect(formatSummary(S(), { currency: "€" })).toContain("Net −€6841.72/yr");
  });

  it("K: unknown or missing currency falls back to the default symbol", () => {
    expect(formatSummary(S(), { currency: "XYZ" })).toContain("Net −$6841.72/yr");
    expect(formatSummary(S(), { currency: null })).toContain("Net −$6841.72/yr");
  });

  it("L: a currency mismatch is explicitly labeled not conversion-adjusted", () => {
    expect(formatSummary(S(), { currency: "€", currencyMismatch: true })).toContain("(not conversion-adjusted)");
  });

  it("M: reversed/uncertain window order never presents the net as authoritative", () => {
    const str = formatSummary(S(), { ordered: false });
    expect(str).toContain("15 changes");
    expect(str).toContain("window order unclear — verify the periods selected");
    expect(str).not.toContain("Net");
    expect(str).not.toContain("$");
  });
});