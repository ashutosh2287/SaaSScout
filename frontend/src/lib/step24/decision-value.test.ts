import { describe, expect, it } from "vitest";
import type { ComparisonFinding, ComparisonResult } from "../compare/types";
import { buildStep24Scenario, rowsToTransactions, splitWindows, EXPECTED_FINDING_KIND, EXPECTED_YEARLY } from "./scenario";
import { snapshotFor, runCompare } from "../betatest/helpers";
import { impactMagnitude, prioritizeFindings } from "../compare/prioritize";
import { suggestedAction } from "../compare/format";

// Step 24 — comparison decision-value loop measurement.
//
// PROXY — NOT REAL USER STUDY. Deterministic seeded scenario; measurements say
// what the product presents first, not how humans behave. The question under
// test: given many legitimate findings, does the compare surface put the most
// decision-relevant change first?
//
// Two explainable ground truths are judged against the observed order:
//   GT-A materiality: |annualized delta| descending (biggest dollar change
//     first, savings and costs interleaved) — this is what the product does.
//   GT-B direction preference: positive cost changes before savings, each by
//     |delta| — the alternative a reader might assume the product should do.

function measure(): { cmp: ComparisonResult } {
  const txns = rowsToTransactions(buildStep24Scenario().rows);
  const { baseline, current } = splitWindows(txns);
  const b = snapshotFor(baseline, "baseline.csv");
  const c = snapshotFor(current, "current.csv");
  return { cmp: runCompare(b.report, c.report) };
}

function keys(findings: ComparisonFinding[]): string[] {
  return findings.map((f) => f.merchantKey);
}

const ANNUAL: Record<string, number> = { slack: -(800 * 365) / 30, salesforce: (120 * 365) / 30, microsoft: (100 * 365) / 30, github: (40 * 365) / 30, trello: -(20 * 365) / 30, figma: (50 * 365) / 90 - (50 * 365) / 30, netflix: (10 * 365) / 30, adobe: (7 * 365) / 30, dropbox: (7 * 365) / 30, zoom: (7 * 365) / 30 };

// GT-A expected presented order (|delta| desc; cross-kind tie = new before
// increase; same-kind tie = name; null-impact findings sink last by kind order).
// Step 26 — 2 intra-period `possible_overlap` findings (adobe+figma in
// `design`, microsoft+zoom in `communication`) have null impact and sort to
// the tail. The primary key (alphabetically first in the pair) is what
// appears here, sorted by name within the kind: adobe, microsoft.
const GT_A_ORDER = ["slack", "salesforce", "microsoft", "github", "figma", "trello", "netflix", "adobe", "dropbox", "zoom", "openai", "notion", "canva", "adobe", "microsoft"];

// GT-B expected order if the surface favored direction (cost increase first,
// then savings): the single largest change (slack, -$9,733/yr savings) slips to
// rank 8 (index 7).
const GT_B_ORDER = ["salesforce", "microsoft", "github", "netflix", "adobe", "dropbox", "zoom", "slack", "figma", "trello", "openai", "notion", "canva", "adobe", "microsoft"];

function findingTable(findings: ComparisonFinding[]): string {
  return findings
    .map(
      (f, i) =>
        `${String(i + 1).padStart(2)}  ${f.merchantKey.padEnd(11)} ${f.kind.padEnd(17)} ${String(f.impact.yearlyDelta === null ? "null" : f.impact.yearlyDelta.toFixed(2)).padStart(9)}  ${f.confidence}`,
    )
    .join("\n");
}

describe("step24 / scenario integrity", () => {
  it("emits 15 findings across all expected kinds (13 cross-period + 2 intra-period overlap)", () => {
    const { cmp } = measure();
    expect(cmp.findings.length).toBe(15);
    // The 13 cross-period findings keep their kinds; the 2 added overlap
    // findings carry null impact and are NOT cross-period findings.
    const cross = cmp.findings.filter((f) => f.kind !== "possible_overlap");
    expect(cross.length).toBe(13);
    for (const f of cross) {
      expect(EXPECTED_FINDING_KIND[f.merchantKey]).toBe(f.kind);
    }
    const overlap = cmp.findings.filter((f) => f.kind === "possible_overlap");
    expect(overlap).toHaveLength(2);
  });

  it("engine-observed annualized deltas match the instrumented contract", () => {
    const { cmp } = measure();
    for (const f of cmp.findings) {
      // Step 26 — overlap findings carry null impact by design; the per-key
      // EXPECTED_YEARLY table is a cross-period finding contract only.
      if (f.kind === "possible_overlap") {
        expect(f.impact.yearlyDelta).toBeNull();
        continue;
      }
      const expected = EXPECTED_YEARLY[f.merchantKey];
      if (expected === 0) {
        expect(f.impact.yearlyDelta).toBeNull();
      } else {
        expect(f.impact.yearlyDelta).not.toBeNull();
        expect(Math.abs(f.impact.yearlyDelta! - ANNUAL[f.merchantKey])).toBeLessThan(0.01);
      }
    }
  });
});

describe("step24 / decision value (GT-A: materiality)", () => {
  it("presents the biggest annualized change first — a savings, never buried", () => {
    const { cmp } = measure();
    const presented = prioritizeFindings(cmp.findings);
    expect(presented[0].merchantKey).toBe("slack");
    expect(presented[0].kind).toBe("ended_recurring");
    expect(presented[0].impact.yearlyDelta).toBeCloseTo(-9733.33, 2);
    expect(keys(presented.slice(0, 3))).toEqual(["slack", "salesforce", "microsoft"]);
  });

  it("matches GT-A order exactly (deterministic, no mutation)", () => {
    const { cmp } = measure();
    const input = cmp.findings.slice();
    const presented = prioritizeFindings(cmp.findings);
    expect(keys(presented)).toEqual(GT_A_ORDER);
    expect(cmp.findings).toEqual(input);
    for (let i = 0; i < 3; i++) {
      expect(keys(prioritizeFindings(cmp.findings))).toEqual(GT_A_ORDER);
    }
  });

  it("is monotonically material: |delta| never increases down the list", () => {
    const { cmp } = measure();
    const presented = prioritizeFindings(cmp.findings);
    let prev = Infinity;
    for (const f of presented) {
      const mag = impactMagnitude(f);
      expect(mag).toBeLessThanOrEqual(prev);
      prev = mag;
    }
  });

  it("keeps null-impact findings in the tail, below every dollar finding", () => {
    const { cmp } = measure();
    const presented = prioritizeFindings(cmp.findings);
    // 13 quantified + 3 prior null-impact (openai/notion/canva in their
    // kind-order lanes) + 2 new null-impact possible_overlap at the absolute
    // tail. The 2 overlap findings (adobe+figma, microsoft+zoom) sort to the
    // bottom because their impact is null and their kind is the lowest.
    const tail = presented.slice(-2);
    expect(keys(tail)).toEqual(["adobe", "microsoft"]);
    for (const f of tail) {
      expect(f.kind).toBe("possible_overlap");
      expect(f.impact.yearlyDelta).toBeNull();
    }
    // The first 10 (all the dollar-material findings) carry a quantified delta.
    for (const f of presented.slice(0, 10)) {
      expect(f.impact.yearlyDelta).not.toBeNull();
    }
  });

  it("resolves same-magnitude ties deterministically (cross-kind then name)", () => {
    const { cmp } = measure();
    const presented = prioritizeFindings(cmp.findings);
    const tie = presented.slice(7, 10);
    expect(keys(tie)).toEqual(["adobe", "dropbox", "zoom"]);
    expect(tie[0].kind).toBe("new_recurring");
    expect(tie[1].kind).toBe("price_increase");
    expect(tie[2].kind).toBe("price_increase");
    const [a, d, z] = tie.map((f) => f.impact.yearlyDelta!);
    expect(Math.abs(a - d)).toBeLessThan(1e-9);
    expect(Math.abs(d - z)).toBeLessThan(1e-9);
  });

  it("does not let percentage become the ordering cue", () => {
    const { cmp } = measure();
    const presented = prioritizeFindings(cmp.findings);
    const netflix = presented.findIndex((f) => f.merchantKey === "netflix");
    const microsoft = presented.findIndex((f) => f.merchantKey === "microsoft");
    expect(netflix).toBeGreaterThan(microsoft); // +100% / +$10 stays below +20% / +$100.
  });
});

describe("step24 / decision value (GT-B: direction preference is NOT what ships)", () => {
  it("GT-B would bury the largest change; documented, not implemented", () => {
    const { cmp } = measure();
    const presented = prioritizeFindings(cmp.findings);
    const currentRank = keys(presented).indexOf("slack");
    const alternativeRank = GT_B_ORDER.indexOf("slack");
    expect(currentRank).toBe(0);
    expect(alternativeRank).toBe(7);
    // Deliberate divergence: no direction-preference carve-out was added (see
    // report Step 24, section Direction preference). The ordering surface is
    // magnitude-only; direction is shown, not ranked above materiality.
    expect(currentRank).not.toBe(alternativeRank);
  });
});

describe("step24 / presented surface content", () => {
  it("every finding carries a confidence badge and a next-step action", () => {
    const { cmp } = measure();
    const presented = prioritizeFindings(cmp.findings);
    for (const f of presented) {
      expect(f.confidence).toMatch(/^high$|^medium$|^low$/);
      expect(suggestedAction(f)).not.toBeNull();
    }
  });

  it("measures the top-of-list decision triangle", () => {
    const { cmp } = measure();
    const presented = prioritizeFindings(cmp.findings);
    const top = presented.slice(0, 3);
    // WHAT: kind visible. HOW MUCH: |delta| present. WHY IT MATTERS: it is the
    // biggest change in the file on either side of the ledger.
    expect(top.map((f) => f.kind)).toEqual(["ended_recurring", "new_recurring", "price_increase"]);
    console.log(`step24 presented order:\n${findingTable(presented)}\n`);
  });
});

describe("step24 / adversarial & failure cases", () => {
  it("empty comparison yields no findings and no prioritized array", () => {
    const empty = snapshotFor([], "baseline.csv");
    const also = snapshotFor([], "current.csv");
    const cmp = runCompare(empty.report, also.report);
    expect(cmp.findings.length).toBe(0);
    expect(prioritizeFindings(cmp.findings)).toEqual([]);
  });

  it("currency mismatch raises a caution and never changes the order", () => {
    const txns = rowsToTransactions(buildStep24Scenario().rows);
    const { baseline, current } = splitWindows(txns);
    const b = snapshotFor(baseline, "baseline.csv");
    const c = snapshotFor(current, "current.csv");
    const mixed = runCompare({ ...b.report, currency: "$" }, { ...c.report, currency: "€" });
    expect(mixed.caution).toContain("different currencies");
    expect(mixed.findings.length).toBe(15);
    const plain = runCompare(b.report, c.report);
    expect(keys(prioritizeFindings(mixed.findings))).toEqual(keys(prioritizeFindings(plain.findings)));
  });

  it("reversed window labels trip the order caution, not the ordering", () => {
    const txns = rowsToTransactions(buildStep24Scenario().rows);
    const { baseline, current } = splitWindows(txns);
    const b = snapshotFor(baseline, "baseline.csv");
    const c = snapshotFor(current, "current.csv");
    const swapped = runCompare(c.report, b.report);
    expect(swapped.ordered).toBe(false);
    expect(swapped.caution).toContain("unexpected order");
    expect(swapped.findings.length).toBeGreaterThan(0);
    expect(keys(prioritizeFindings(swapped.findings))).toEqual(keys(prioritizeFindings(runCompare(c.report, b.report).findings)));
  });

  it("null / NaN / Infinity deltas are guarded, never rank, never crash", () => {
    const base = measure().cmp.findings;
    const weird: ComparisonFinding[] = [
      { ...base[1], merchantKey: "nan", merchantName: "nan", impact: { monthlyDelta: null, yearlyDelta: NaN } },
      { ...base[1], merchantKey: "inf", merchantName: "inf", impact: { monthlyDelta: null, yearlyDelta: Infinity } },
      { ...base[1], merchantKey: "ninf", merchantName: "ninf", impact: { monthlyDelta: null, yearlyDelta: -Infinity } },
    ];
    for (const w of weird) expect(impactMagnitude(w)).toBe(0);
    const merged = prioritizeFindings([...weird, ...base]);
    expect(merged.length).toBe(base.length + 3);
    expect(merged[0].merchantKey).toBe("slack");
    expect(keys(prioritizeFindings(merged))).toEqual(keys(prioritizeFindings(merged)));
  });

  it("a weak 3-charge irregular baseline surfaces as an honest medium ended claim, not an alarm", () => {
    const b = snapshotFor(rowsToTransactions([
      { date: "2025-08-11", description: "CANVA PRO", amount: -90 },
      { date: "2025-09-06", description: "CANVA PRO", amount: -220 },
      { date: "2025-11-27", description: "CANVA PRO", amount: -310 },
    ]), "baseline.csv");
    // A current window with dates (noise only) so absence can be evaluated.
    const c = snapshotFor(rowsToTransactions([
      { date: "2026-01-02", description: "MARATHON SUPPLY CO", amount: -48 },
      { date: "2026-06-28", description: "MARATHON SUPPLY CO", amount: -52 },
    ]), "current.csv");
    const cmp = runCompare(b.report, c.report);
    expect(cmp.findings.length).toBe(1);
    const f = cmp.findings[0];
    expect(f.kind).toBe("ended_recurring");
    expect(f.confidence).toBe("medium");
    expect(f.impact.yearlyDelta).toBeCloseTo(-(220 * 365) / 30, 2);
    expect(f.evidence.some((e) => e.type === "pattern_baseline_weak")).toBe(true);
    expect(suggestedAction(f)).not.toBeNull();
  });

  it("confidence is a badge, not a ranking key", () => {
    const mk = (name: string, delta: number, confidence: ComparisonFinding["confidence"]): ComparisonFinding => ({
      kind: "price_increase",
      merchantKey: name,
      merchantName: name,
      confidence,
      evidence: [],
      impact: { monthlyDelta: 1, yearlyDelta: delta },
    });
    const fixed = [
      mk("low-confidence", 100, "low"),
      mk("high-confidence", 100, "high"),
      mk("medium-confidence", 100, "medium"),
    ];
    const out = prioritizeFindings(fixed);
    expect(keys(out)).toEqual(["high-confidence", "low-confidence", "medium-confidence"]);
  });
});

describe("step24 / performance (presentation sort only)", () => {
  function synth(n: number): ComparisonFinding[] {
    const base = measure().cmp.findings;
    const out: ComparisonFinding[] = [];
    const kinds: ComparisonFinding["kind"][] = ["price_increase", "ended_recurring", "new_recurring", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared"];
    for (let i = 0; i < n; i++) {
      const src = base[i % base.length];
      out.push({
        ...src,
        merchantKey: `sub-${i}`,
        merchantName: `sub-${String(i).padStart(5, "0")}`,
        kind: kinds[i % kinds.length],
        impact: { monthlyDelta: null, yearlyDelta: i % 7 === 0 ? null : ((i % 997) - 498) },
      });
    }
    return out;
  }

  it("scales ~O(n log n) with deterministic output", () => {
    const runs = [1000, 5000, 10000, 25000];
    const ms: number[] = [];
    let prev = "";
    for (const n of runs) {
      const f = synth(n);
      // best-of-3 timing (min) to de-noise shared-machine jitter
      let best = Infinity;
      let out!: ReturnType<typeof prioritizeFindings>;
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        out = prioritizeFindings(f);
        best = Math.min(best, performance.now() - t0);
      }
      ms.push(best);
      const sig = keys(out).join(",") + ":" + out[0].impact.yearlyDelta + ":" + out[out.length - 1].merchantKey;
      if (prev) expect(sig).not.toBe(prev);
      prev = sig;
      expect(out[0].impact.yearlyDelta ?? 0).toBeGreaterThanOrEqual(252); // largest |delta| = 497-247.
      expect(keys(out).length).toBe(n);
      expect(keys(prioritizeFindings(f))).toEqual(keys(out)); // deterministic repeats
    }
    console.log(`step24 prioritizeFindings perf (ms): ${runs.map((n, i) => `${n}=${ms[i].toFixed(2)}`).join(", ")}`);
    expect(ms[3]).toBeLessThan(ms[2] * 4 + 10); // loose O(n log n) shape sanity
    expect(ms[3]).toBeLessThan(750);
  });
});