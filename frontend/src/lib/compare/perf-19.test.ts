import { describe, expect, it } from "vitest";
import type { ReportMerchant, SasscoutReport } from "../report/types";
import type { RecurringPattern } from "../recurring/types";
import { compareReports } from "./engine";

// Step 19 — wall-clock bound for the comparison engine at the 25k-merchant
// product ceiling. The identity guard builds its token index once per report
// pair (one pass over every appearing merchant's descriptions) and each absent
// merchant touches only the sparse buckets its own tokens index into, so the
// compare phase must stay comfortably linear-ish and sub-second.

const N = 25_000;
const ABSENT = 1_000;
const APPEARING = 1_000;

function pattern(firstSeen: string, lastSeen: string): RecurringPattern {
  return {
    status: "likely_recurring",
    confidence: "high",
    interval: "monthly",
    evidence: [],
    transactionCount: 3,
    firstSeen,
    lastSeen,
    typicalAmount: 10,
    strength: "strong",
    amountProfile: "highly_stable",
    intervalConsistency: 1,
    patternSpanMonths: 2,
    gapCount: 0,
    priceChange: null,
  };
}

function merchant(key: string, raws: string[], p: RecurringPattern): ReportMerchant {
  return {
    normalizedKey: key,
    merchantName: key,
    transactionCount: p.transactionCount,
    firstSeen: p.firstSeen,
    lastSeen: p.lastSeen,
    distinctRawDescriptions: raws,
    recurring: p,
    softwareStatus: "software",
    totalSpend: -30,
    typicalTransactionAmount: 10,
    estimatedMonthlySpend: null,
    estimatedYearlySpend: null,
    review: null,
    classification: {} as never,
  } as unknown as ReportMerchant;
}

function report(keys: number[], start: string, end: string): SasscoutReport {
  const merchants = keys.map((i) =>
    merchant(`v${i}`, [`VND${i} ${i}`], pattern("2026-01-10", "2026-03-10")),
  );
  return {
    quality: {
      summary: {},
      coverage: {},
      date: { count: 3, completeness: 1, earliest: start, latest: end },
    },
    merchants,
    generatedAt: "2026-09-05T00:00:00.000Z",
  } as unknown as SasscoutReport;
}

describe("Step 19 — comparison engine at 25k merchants", () => {
  it("returns within budget with no superlinear blowup", () => {
    // Baseline: v0..vN-1 (25k). Current: v0..vN-ABSENT-1 stable (24k) plus
    // vN..vN+APPEARING-1 new (1k). So ABSENT software merchants vanish while
    // APPEARING different-key merchants show up, exercising the identity guard.
    const baseline = report([...Array(N).keys()], "2026-01-01", "2026-03-31");
    const currentKeys = [
      ...[...Array(N - ABSENT).keys()],
      ...[...Array(APPEARING).keys()].map((i) => N + i),
    ];
    const current = report(currentKeys, "2026-04-01", "2026-06-30");
    // Force PAIRED=true on a slice of absent+appearing merchants: rewrite 300 of
    // each with descriptions that share two bag-of-words tokens (Dice 2/3) so
    // the guard's pairing math actually runs over big lists, not just the index.
    const PAIRED = 300;
    const pairedAbsent = (i: number) => `SHAREDP20 SHAREDP21 A${i}`;
    const pairedAppearing = (i: number) => `SHAREDP20 SHAREDP21 B${i}`;
    for (let i = 0; i < PAIRED; i++) {
      baseline.merchants[N - ABSENT + i].distinctRawDescriptions = [pairedAbsent(i)];
      current.merchants[N - ABSENT + i].distinctRawDescriptions = [pairedAppearing(i)];
    }

    const start = performance.now();
    const res = compareReports(baseline, current, { baseline: "a.csv", current: "b.csv" });
    const elapsed = performance.now() - start;

    // The guard really ran over the vanished+appearing set and the 300 paired
    // merchants were suppressed as identity_uncertain (a record for BOTH the
    // vanished merchant's "ended" and the appearing merchant's "new"), not
    // falsely "ended".
    const identitySuppressed = res.insufficientEvidence.filter(
      (h) => h.category === "identity_uncertain",
    ).length;
    const falseEnded = res.findings.filter(
      (f) => f.kind === "ended_recurring",
    ).length;
    console.log(`measured compareReports at ${N} merchants: ${elapsed.toFixed(1)}ms`);
    console.log(`identity-uncertain suppressions exercised: ${identitySuppressed}`);
    console.log(`ended findings: ${falseEnded}`);

    expect(identitySuppressed).toBe(PAIRED * 2);
    expect(falseEnded).toBe(ABSENT - PAIRED);
    expect(elapsed).toBeLessThan(2000);
  });
});