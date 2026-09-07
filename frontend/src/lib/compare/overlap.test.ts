import { describe, expect, it } from "vitest";
import type { ReportMerchant, SasscoutReport } from "../report/types";
import type { RecurringPattern } from "../recurring/types";
import { detectIntraPeriodOverlaps } from "./overlap";
import { OVERLAP_ELIGIBLE_SUBCATEGORIES, subcategoryFor, SUBCATEGORY_MEMBERS } from "./subcategories";

function pattern(over: Partial<RecurringPattern> = {}): RecurringPattern {
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

function merchant(
  key: string,
  name: string,
  raws: string[],
  p: RecurringPattern | null,
  softwareStatus: "software" | "uncertain" | "not_software" | null = "software",
): ReportMerchant {
  return {
    normalizedKey: key,
    merchantName: name,
    transactionCount: p?.transactionCount ?? 0,
    firstSeen: p?.firstSeen ?? null,
    lastSeen: p?.lastSeen ?? null,
    distinctRawDescriptions: raws,
    recurring: p,
    softwareStatus,
    totalSpend: p ? -(p.typicalAmount ?? 0) * p.transactionCount : 0,
    typicalTransactionAmount: p?.typicalAmount ?? null,
    estimatedMonthlySpend: null,
    estimatedYearlySpend: null,
    review: null,
    classification: {} as never,
  } as unknown as ReportMerchant;
}

function reportWith(merchants: ReportMerchant[]): SasscoutReport {
  return {
    quality: {
      summary: {},
      coverage: {},
      date: { count: 3, completeness: 1, earliest: "2026-01-01", latest: "2026-03-31" },
    },
    merchants,
    generatedAt: "2026-09-05T00:00:00.000Z",
  } as unknown as SasscoutReport;
}

describe("subcategory map", () => {
  it("returns the curated subcategory for a known merchant", () => {
    expect(subcategoryFor("slack")).toBe("team-collaboration");
    expect(subcategoryFor("zoom")).toBe("communication");
    expect(subcategoryFor("github")).toBe("developer-tools");
    expect(subcategoryFor("salesforce")).toBe("crm-sales");
  });

  it("returns null for an unknown merchant — the conservative default", () => {
    expect(subcategoryFor("some-random-vendor")).toBeNull();
    expect(subcategoryFor(null)).toBeNull();
  });

  it("places every curated merchant into exactly one subcategory", () => {
    const seen = new Set<string>();
    for (const sub of Object.values(SUBCATEGORY_MEMBERS)) {
      for (const k of sub) {
        expect(seen.has(k)).toBe(false); // no duplicates across subcategories
        seen.add(k);
      }
    }
  });

  it("declares overlap-ineligible subcategories (e.g. hosting, developer)", () => {
    expect(OVERLAP_ELIGIBLE_SUBCATEGORIES.has("hosting-infrastructure")).toBe(false);
    expect(OVERLAP_ELIGIBLE_SUBCATEGORIES.has("developer-tools")).toBe(false);
    expect(OVERLAP_ELIGIBLE_SUBCATEGORIES.has("team-collaboration")).toBe(true);
    expect(OVERLAP_ELIGIBLE_SUBCATEGORIES.has("communication")).toBe(true);
  });
});

describe("detectIntraPeriodOverlaps", () => {
  it("emits a possible_overlap finding for two recurring subcategory peers", () => {
    const slack = merchant("slack", "Slack", ["SLACK"], pattern());
    const trello = merchant("trello", "Trello", ["TRELLO GOLD"], pattern());
    const res = detectIntraPeriodOverlaps(reportWith([slack, trello]));
    expect(res).toHaveLength(1);
    const f = res[0];
    expect(f.kind).toBe("possible_overlap");
    expect(f.merchantKey).toBe("slack"); // alphabetical first
    expect(f.merchantName).toBe("Slack");
    expect(f.pair?.merchantKey).toBe("trello");
    expect(f.pair?.merchantName).toBe("Trello");
    expect(f.pair?.subcategory).toBe("team-collaboration");
    expect(f.confidence).toBe("high");
    expect(f.impact.monthlyDelta).toBeNull();
    expect(f.impact.yearlyDelta).toBeNull();
    expect(f.evidence.map((e) => e.type)).toEqual(
      expect.arrayContaining(["shared_subcategory", "both_recurring_current", "overlap_not_duplication"]),
    );
  });

  it("does NOT emit overlap when only one merchant is in a subcategory", () => {
    const slack = merchant("slack", "Slack", ["SLACK"], pattern());
    const res = detectIntraPeriodOverlaps(reportWith([slack]));
    expect(res).toHaveLength(0);
  });

  it("does NOT emit overlap when one merchant is not classified as software", () => {
    const slack = merchant("slack", "Slack", ["SLACK"], pattern(), "software");
    const trello = merchant("trello", "Trello", ["TRELLO GOLD"], pattern(), "not_software");
    const res = detectIntraPeriodOverlaps(reportWith([slack, trello]));
    expect(res).toHaveLength(0);
  });

  it("does NOT emit overlap when one merchant is not recurring (one-off charge)", () => {
    const slack = merchant("slack", "Slack", ["SLACK"], pattern());
    const trello = merchant("trello", "Trello", ["TRELLO GOLD"], null);
    const res = detectIntraPeriodOverlaps(reportWith([slack, trello]));
    expect(res).toHaveLength(0);
  });

  it("does NOT emit overlap when the recurring pattern has no concrete interval", () => {
    const slack = merchant("slack", "Slack", ["SLACK"], pattern({ interval: "irregular" }));
    const trello = merchant("trello", "Trello", ["TRELLO GOLD"], pattern({ interval: "irregular" }));
    const res = detectIntraPeriodOverlaps(reportWith([slack, trello]));
    expect(res).toHaveLength(0);
  });

  it("does NOT emit overlap for an ineligible subcategory (e.g. developer-tools)", () => {
    const gh = merchant("github", "GitHub", ["GITHUB"], pattern());
    const gl = merchant("gitlab", "GitLab", ["GITLAB"], pattern());
    const res = detectIntraPeriodOverlaps(reportWith([gh, gl]));
    expect(res).toHaveLength(0);
  });

  it("does NOT emit overlap for an ineligible subcategory (hosting-infrastructure)", () => {
    const aws = merchant("aws", "AWS", ["AWS"], pattern());
    const doC = merchant("digitalocean", "DigitalOcean", ["DIGITALOCEAN"], pattern());
    const res = detectIntraPeriodOverlaps(reportWith([aws, doC]));
    expect(res).toHaveLength(0);
  });

  it("does NOT emit overlap when both merchants are unknown to the curated map", () => {
    // Even if both look like SaaS by classification, the map gate is the only
    // path to a subcategory; an unknown merchant cannot be invented into one.
    const a = merchant("acme", "Acme", ["ACME"], pattern());
    const b = merchant("initech", "Initech", ["INITECH"], pattern());
    const res = detectIntraPeriodOverlaps(reportWith([a, b]));
    expect(res).toHaveLength(0);
  });

  it("does NOT emit overlap between two merchants in different subcategories", () => {
    // slack is team-collaboration; zoom is communication. No shared subcategory.
    const slack = merchant("slack", "Slack", ["SLACK"], pattern());
    const zoom = merchant("zoom", "Zoom", ["ZOOM.US"], pattern());
    const res = detectIntraPeriodOverlaps(reportWith([slack, zoom]));
    expect(res).toHaveLength(0);
  });

  it("emits ONE finding per pair (no duplicate emission on re-iteration)", () => {
    const slack = merchant("slack", "Slack", ["SLACK"], pattern());
    const trello = merchant("trello", "Trello", ["TRELLO GOLD"], pattern());
    const res = detectIntraPeriodOverlaps(reportWith([slack, trello]));
    expect(res).toHaveLength(1);
  });

  it("emits a medium-confidence finding when one is possibly_recurring", () => {
    const slack = merchant("slack", "Slack", ["SLACK"], pattern({ status: "possibly_recurring" }));
    const trello = merchant("trello", "Trello", ["TRELLO GOLD"], pattern());
    const res = detectIntraPeriodOverlaps(reportWith([slack, trello]));
    expect(res).toHaveLength(1);
    expect(res[0].confidence).toBe("medium");
  });

  it("emits a low-confidence finding when both are possibly_recurring", () => {
    const slack = merchant("slack", "Slack", ["SLACK"], pattern({ status: "possibly_recurring" }));
    const trello = merchant("trello", "Trello", ["TRELLO GOLD"], pattern({ status: "possibly_recurring" }));
    const res = detectIntraPeriodOverlaps(reportWith([slack, trello]));
    expect(res).toHaveLength(1);
    expect(res[0].confidence).toBe("low");
  });

  it("emits multiple findings for two distinct eligible subcategories", () => {
    // Slack+Trello (team-collaboration) AND Figma+Adobe (design)
    const slack = merchant("slack", "Slack", ["SLACK"], pattern());
    const trello = merchant("trello", "Trello", ["TRELLO GOLD"], pattern());
    const figma = merchant("figma", "Figma", ["FIGMA"], pattern());
    const adobe = merchant("adobe", "Adobe", ["ADOBE"], pattern());
    const res = detectIntraPeriodOverlaps(reportWith([slack, trello, figma, adobe]));
    expect(res).toHaveLength(2);
    const subs = res.map((r) => r.pair?.subcategory).sort();
    expect(subs).toEqual(["design", "team-collaboration"]);
  });

  it("emits all pair combinations when a subcategory has 3 eligible merchants", () => {
    // Three merchants in `team-collaboration`: slack, trello, notion → 3 pairs.
    const slack = merchant("slack", "Slack", ["SLACK"], pattern());
    const trello = merchant("trello", "Trello", ["TRELLO GOLD"], pattern());
    const notion = merchant("notion", "Notion", ["NOTION"], pattern());
    const res = detectIntraPeriodOverlaps(reportWith([slack, trello, notion]));
    expect(res).toHaveLength(3);
  });

  it("returns findings in deterministic order across runs", () => {
    const slack = merchant("slack", "Slack", ["SLACK"], pattern());
    const trello = merchant("trello", "Trello", ["TRELLO GOLD"], pattern());
    const a = detectIntraPeriodOverlaps(reportWith([slack, trello]));
    const b = detectIntraPeriodOverlaps(reportWith([slack, trello]));
    expect(a.map((f) => `${f.kind}:${f.merchantKey}:${f.pair?.merchantKey}`)).toEqual(
      b.map((f) => `${f.kind}:${f.merchantKey}:${f.pair?.merchantKey}`),
    );
  });

  it("does not mutate the input report", () => {
    const slack = merchant("slack", "Slack", ["SLACK"], pattern());
    const trello = merchant("trello", "Trello", ["TRELLO GOLD"], pattern());
    const report = reportWith([slack, trello]);
    const snapshot = JSON.stringify(report);
    detectIntraPeriodOverlaps(report);
    expect(JSON.stringify(report)).toBe(snapshot);
  });
});
