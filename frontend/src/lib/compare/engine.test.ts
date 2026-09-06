import { describe, expect, it } from "vitest";
import type { ReportMerchant, SasscoutReport } from "../report/types";
import type { RecurringPattern } from "../recurring/types";
import {
  windowOf,
  cyclesCovered,
  concretePeriodDays,
  observedAbsenceDays,
  cadenceBrokenEvidence,
  compareReports,
} from "./engine";

function reportWithWindow(start: string, end: string): SasscoutReport {
  return {
    quality: {
      summary: {},
      coverage: {},
      date: { count: 3, completeness: 1, earliest: start, latest: end },
    },
    merchants: [],
    generatedAt: "2026-09-05T00:00:00.000Z",
  } as unknown as SasscoutReport;
}

function pattern(over: Partial<RecurringPattern>): RecurringPattern {
  return {
    status: "likely_recurring",
    confidence: "high",
    interval: "monthly",
    evidence: [],
    transactionCount: 3,
    firstSeen: "2026-01-10",
    lastSeen: "2026-03-10",
    typicalAmount: 10,
    strength: "strong",
    amountProfile: "highly_stable",
    intervalConsistency: 1,
    patternSpanMonths: 2,
    gapCount: 0,
    priceChange: null,
    ...over,
  };
}

function merchant(key: string, name: string, raws: string[], p: RecurringPattern | null): ReportMerchant {
  return {
    normalizedKey: key,
    merchantName: name,
    transactionCount: p?.transactionCount ?? 0,
    firstSeen: p?.firstSeen ?? null,
    lastSeen: p?.lastSeen ?? null,
    distinctRawDescriptions: raws,
    recurring: p,
    softwareStatus: "software",
    // Spend flows OUT: total spend is negative like the real pipeline.
    totalSpend: -((p?.typicalAmount ?? 0) * (p?.transactionCount ?? 0)),
    typicalTransactionAmount: p?.typicalAmount ?? null,
    estimatedMonthlySpend: null,
    estimatedYearlySpend: null,
    review: null,
    classification: {} as never,
  } as unknown as ReportMerchant;
}

function reportWith(start: string, end: string, merchants: ReportMerchant[]): SasscoutReport {
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

const SPOTIFY_A = merchant("spotify", "Spotify", ["SPOTIFY"], pattern({
  transactionCount: 3, firstSeen: "2026-01-03", lastSeen: "2026-03-03",
}));

describe("compare helpers", () => {
  it("windowOf derives days from earliest/latest", () => {
    const w = windowOf(reportWithWindow("2026-01-02", "2026-03-02"));
    expect(w.start).toBe("2026-01-02");
    expect(w.end).toBe("2026-03-02");
    expect(w.days).toBe(59);
  });

  it("windowOf tolerates reports with no dates", () => {
    expect(windowOf({ quality: {} } as SasscoutReport).days).toBeNull();
  });
});

describe("cyclesCovered", () => {
  it("returns null when inputs are unknown", () => {
    expect(cyclesCovered(null, 30)).toBeNull();
    expect(cyclesCovered(30, null)).toBeNull();
    expect(cyclesCovered(30, 0)).toBeNull();
  });

  it("reports zero cycles for a zero-day window", () => {
    expect(cyclesCovered(0, 30)).toBe(0);
  });

  it("computes expected cycles a window would capture", () => {
    // 61-day window at a 30-day cadence = ~2.03 cycles -> >= 1 (evidence) and >= 2 (strong).
    expect(cyclesCovered(61, 30)).toBeGreaterThanOrEqual(2);
    // 90-day window at quarterly cadence = exactly 1 cycle.
    expect(cyclesCovered(90, 90)).toBe(1);
    expect(cyclesCovered(179, 90)).toBeLessThan(2);
    expect(cyclesCovered(180, 90)).toBeGreaterThanOrEqual(2);
    // Annual over 730 days = 2 full cycles.
    expect(cyclesCovered(730, 365)).toBe(2);
  });

  it("stays below one cycle when the window cannot cover a cadence", () => {
    expect(cyclesCovered(29, 30)).toBeLessThan(1);
    expect(cyclesCovered(89, 90)).toBeLessThan(1);
  });
});

describe("concretePeriodDays", () => {
  it("maps intervals to expected pay periods", () => {
    expect(concretePeriodDays("weekly")).toBe(7);
    expect(concretePeriodDays("monthly")).toBe(30);
    expect(concretePeriodDays("quarterly")).toBe(90);
    expect(concretePeriodDays("annual")).toBe(365);
    expect(concretePeriodDays(null)).toBeNull();
  });
});

describe("compareReports ordering guard", () => {
  it("flags un-ordered periods without claiming change", () => {
    const res = compareReports(
      reportWithWindow("2026-03-01", "2026-05-01"),
      reportWithWindow("2026-01-01", "2026-02-01"),
      { baseline: "a.csv", current: "b.csv" },
    );
    expect(res.ordered).toBe(false);
    expect(res.caution).not.toBeNull();
    expect(res.findings).toHaveLength(0);
  });

  it("accepts correctly ordered periods", () => {
    const res = compareReports(
      reportWithWindow("2026-01-01", "2026-02-01"),
      reportWithWindow("2026-03-01", "2026-05-01"),
      { baseline: "a.csv", current: "b.csv" },
    );
    expect(res.ordered).toBe(true);
    expect(res.caution).toBeNull();
  });
});

describe("Step 19 — observed absence is anchored to the last charge", () => {
  it("never counts days where the merchant is provably still present", () => {
    // Baseline window overlaps the current window and the merchant charged
    // late in it (Mar 28). An overlapping window previously implied ~2 cycles
    // of absence; the anchored count correctly sees only ~1 cycle of real
    // absence -> medium confidence, never high.
    const baseline = reportWith("2026-01-01", "2026-03-31", [
      merchant("netflix", "Netflix", ["NETFLIX.COM"], pattern({ lastSeen: "2026-03-28" })),
      SPOTIFY_A,
    ]);
    const current = reportWith("2026-03-01", "2026-04-30", [
      merchant("spotify", "Spotify", ["SPOTIFY"], pattern({ firstSeen: "2026-04-03", lastSeen: "2026-04-30" })),
    ]);
    const res = compareReports(baseline, current, { baseline: "a.csv", current: "b.csv" });
    const ended = res.findings.find((f) => f.kind === "ended_recurring");
    expect(ended).toBeDefined();
    expect(ended!.confidence).toBe("medium");
    expect(ended!.evidence.some((e) => e.type === "last_charge_observed")).toBe(true);
  });

  it("observedAbsenceDays falls back to the window length when no last charge is known", () => {
    expect(observedAbsenceDays(null, "2026-04-01", "2026-06-30")).toBe(90);
    expect(observedAbsenceDays("2026-03-10", "2026-04-01", "2026-06-30")).toBe(90);
    expect(observedAbsenceDays("2026-03-10", null, "2026-06-30")).toBe(112);
  });
});

describe("Step 19 — identity-uncertainty guard (Case E)", () => {
  it("suppresses ENDED when a different-key merchant with overlapping descriptions appears", () => {
    const baseline = reportWith("2026-01-01", "2026-03-31", [SPOTIFY_A]);
    const netflix = merchant("netflix", "Netflix", ["NETFLIX.COM"], pattern({}));
    const current = reportWith("2026-04-01", "2026-06-30", [
      merchant("spotify", "Spotify", ["SPOTIFY"], pattern({})),
      merchant("netflix-de", "Netflix-Streaming-DE", ["NETFLIX-STREAMING-DE"], pattern({})),
    ]);
    // netflix only in baseline; netflix-de only in current, overlapping raw text.
    const res = compareReports(
      { ...baseline, merchants: [...baseline.merchants, netflix] },
      current,
      { baseline: "a.csv", current: "b.csv" },
    );
    expect(res.findings).toHaveLength(0);
    const hit = res.insufficientEvidence.find((h) => h.merchantKey === "netflix" && h.rule === "ended_recurring");
    expect(hit).toBeDefined();
    expect(hit!.category).toBe("identity_uncertain");
  });

  it("does not let a refund-aftermath identity suppress a genuine end", () => {
    const baseline = reportWith("2026-01-01", "2026-03-31", [
      merchant("netflix", "Netflix", ["NETFLIX.COM"], pattern({})),
      SPOTIFY_A,
    ]);
    const current = reportWith("2026-04-01", "2026-06-30", [
      merchant("spotify", "Spotify", ["SPOTIFY"], pattern({})),
      merchant("netflix-refund", "Refund Netflix", ["REFUND NETFLIX"], null),
    ]);
    const res = compareReports(baseline, current, { baseline: "a.csv", current: "b.csv" });
    const ended = res.findings.find((f) => f.kind === "ended_recurring" && f.merchantKey === "netflix");
    expect(ended).toBeDefined();
    expect(ended!.confidence).toBe("high");
  });
});

describe("Step 19 — weak baselines cap the ended claim", () => {
  it("caps to medium when the baseline pattern was itself possibly_recurring", () => {
    const baseline = reportWith("2026-01-01", "2026-03-31", [
      merchant("netflix", "Netflix", ["NETFLIX.COM"], pattern({
        status: "possibly_recurring",
        intervalConsistency: 0.5,
        transactionCount: 2,
        lastSeen: "2026-02-10",
      })),
      SPOTIFY_A,
    ]);
    const current = reportWith("2026-04-01", "2026-06-30", [
      merchant("spotify", "Spotify", ["SPOTIFY"], pattern({})),
    ]);
    const res = compareReports(baseline, current, { baseline: "a.csv", current: "b.csv" });
    const ended = res.findings.find((f) => f.kind === "ended_recurring");
    expect(ended).toBeDefined();
    expect(ended!.confidence).toBe("medium");
    expect(ended!.evidence.some((e) => e.type === "pattern_baseline_weak")).toBe(true);
  });
});

describe("Step 19 — cadenceBrokenEvidence", () => {
  it("recognizes a live scatter of charges as irregular", () => {
    const p = pattern({
      status: "possibly_recurring",
      interval: "irregular",
      intervalConsistency: 0.4,
      transactionCount: 4,
      firstSeen: "2026-04-10",
      lastSeen: "2026-08-02",
    });
    expect(cadenceBrokenEvidence(p, 30)).toBe(true);
  });

  it("stays false for too few charges to call irregular", () => {
    const p = pattern({
      status: "possibly_recurring",
      interval: "irregular",
      intervalConsistency: 0.4,
      transactionCount: 2,
      firstSeen: "2026-04-10",
      lastSeen: "2026-06-10",
    });
    expect(cadenceBrokenEvidence(p, 30)).toBe(false);
  });

  it("stays false while the cadence is still likely", () => {
    const p = pattern({ status: "likely_recurring", interval: "monthly" });
    expect(cadenceBrokenEvidence(p, 30)).toBe(false);
  });
});