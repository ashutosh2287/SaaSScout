import { describe, it, expect } from "vitest";
import { deriveSourceBreakdown } from "./source-breakdown";
import type { NormalizedTransaction } from "../parse/types";
import type { SasscoutReport, ReportMerchant } from "../report/types";
import type { SoftwareSpendSummary } from "../software/types";

function merchant(
  normalizedKey: string,
  descriptions: string[],
  totalSpend: number,
): ReportMerchant {
  return {
    normalizedKey,
    merchantName: descriptions[0] ?? normalizedKey,
    distinctRawDescriptions: descriptions,
    totalSpend,
    transactionCount: descriptions.length,
    firstSeen: "2025-01-15",
    lastSeen: "2025-12-15",
    classification: { category: "likely_saas", confidence: "high", evidence: [] },
    recurring: null,
    softwareStatus: "software",
    typicalTransactionAmount: null,
    estimatedMonthlySpend: null,
    estimatedYearlySpend: null,
    review: null,
  };
}

function summary(total: number): SoftwareSpendSummary {
  return {
    totalSoftwareSpend: total,
    estimatedMonthlySpend: Math.round(total / 12),
    estimatedYearlySpend: total,
    softwareMerchantCount: 1,
    recurringSoftwareMerchantCount: 0,
    nonRecurringSoftwareMerchantCount: 1,
    uncertainMerchantCount: 0,
    topSoftwareByTotal: [],
    topRecurringByMonthly: [],
  };
}

function report(merchants: ReportMerchant[], total: number): SasscoutReport {
  return {
    reportVersion: 1,
    generatedAt: "2025-12-15T00:00:00Z",
    file: { name: "x.csv", totalRows: 0, parsedRows: 0, skippedRows: 0 },
    currency: "USD",
    quality: {} as SasscoutReport["quality"],
    classification: {} as SasscoutReport["classification"],
    softwareSpend: summary(total),
    review: {} as SasscoutReport["review"],
    merchants,
  };
}

let nextId = 0;
function tx(
  date: string,
  description: string,
  amount: number,
  source?: string,
): NormalizedTransaction {
  return {
    id: `t${++nextId}`,
    date,
    description,
    amount,
    currency: "USD",
    sourceRow: 1,
    ...(source ? { source } : {}),
  };
}

describe("deriveSourceBreakdown", () => {
  it("returns no breakdown for a single source", () => {
    const r = report([merchant("adobe", ["ADOBE CREATIVE CLOUD"], 600)], 600);
    const out = deriveSourceBreakdown(r, [tx("2025-02-01", "ADOBE CREATIVE CLOUD", -50, "card")], ["card"]);
    expect(out.isMultiSource).toBe(false);
    expect(out.bySource).toEqual([]);
  });

  it("returns no breakdown when totalSoftwareSpend is 0", () => {
    const r = report([], 0);
    const out = deriveSourceBreakdown(r, [], ["a", "b"]);
    expect(out.isMultiSource).toBe(false);
  });

  it("attributes per-source share from tagged transactions", () => {
    const r = report(
      [merchant("adobe", ["ADOBE CREATIVE CLOUD"], 600), merchant("slack", ["SLACK"], 240)],
      840,
    );
    const txns: NormalizedTransaction[] = [
      tx("2025-01-15", "ADOBE CREATIVE CLOUD", -400, "amex"),
      tx("2025-02-15", "ADOBE CREATIVE CLOUD", -200, "visa"),
      tx("2025-03-15", "SLACK", -120, "amex"),
      tx("2025-04-15", "SLACK", -120, "visa"),
      tx("2025-05-15", "WHOLE FOODS", -100, "amex"),
    ];
    const out = deriveSourceBreakdown(r, txns, ["amex", "visa"]);
    // amex: 400+120 = 520; visa: 200+120 = 320; total = 840
    // amex share = 62%, visa share = 38%
    expect(out.isMultiSource).toBe(true);
    expect(out.totalIdentifiedSoftwareSpend).toBe(840);
    const byLabel = Object.fromEntries(out.bySource.map((e) => [e.label, e.sharePercent]));
    expect(byLabel.amex + byLabel.visa).toBe(100);
    expect(byLabel.amex).toBe(62);
    expect(byLabel.visa).toBe(38);
  });

  it("buckets tagless transactions as (unspecified) rather than mixing into source 0", () => {
    const r = report([merchant("adobe", ["ADOBE"], 600)], 600);
    const txns: NormalizedTransaction[] = [
      tx("2025-01-15", "ADOBE", -300, "amex"),
      tx("2025-02-15", "ADOBE", -300),
    ];
    const out = deriveSourceBreakdown(r, txns, ["amex", "visa"]);
    expect(out.isMultiSource).toBe(true);
    const labels = out.bySource.map((e) => e.label).sort();
    expect(labels).toEqual(["(unspecified)", "amex"]);
    expect(out.bySource.find((e) => e.label === "(unspecified)")?.sharePercent).toBe(50);
  });

  it("ignores positive-amount transactions (refunds / credits)", () => {
    const r = report([merchant("adobe", ["ADOBE"], 600)], 600);
    const txns: NormalizedTransaction[] = [
      tx("2025-01-15", "ADOBE", -600, "amex"),
      tx("2025-02-15", "ADOBE", 50, "visa"),
    ];
    const out = deriveSourceBreakdown(r, txns, ["amex", "visa"]);
    expect(out.bySource).toHaveLength(1);
    expect(out.bySource[0]?.label).toBe("amex");
    expect(out.bySource[0]?.sharePercent).toBe(100);
  });

  it("returns no breakdown when no transactions match a software merchant", () => {
    const r = report([merchant("adobe", ["ADOBE"], 600)], 600);
    const txns = [tx("2025-01-15", "WHOLE FOODS", -50, "amex")];
    const out = deriveSourceBreakdown(r, txns, ["amex", "visa"]);
    expect(out.isMultiSource).toBe(false);
  });

  it("matches descriptions case-insensitively (parser trims/normalizes)", () => {
    const r = report([merchant("adobe", ["ADOBE CREATIVE CLOUD"], 600)], 600);
    const txns: NormalizedTransaction[] = [
      tx("2025-01-15", "  Adobe Creative Cloud  ", -400, "amex"),
      tx("2025-02-15", "ADOBE CREATIVE CLOUD", -200, "visa"),
    ];
    const out = deriveSourceBreakdown(r, txns, ["amex", "visa"]);
    const byLabel = Object.fromEntries(out.bySource.map((e) => [e.label, e.sharePercent]));
    expect(byLabel.amex + byLabel.visa).toBe(100);
    expect(byLabel.amex).toBe(67);
    expect(byLabel.visa).toBe(33);
  });

  it("sorts entries by amount desc, label asc", () => {
    const r = report([merchant("adobe", ["ADOBE"], 1000)], 1000);
    const txns: NormalizedTransaction[] = [
      tx("2025-01-15", "ADOBE", -200, "amex"),
      tx("2025-02-15", "ADOBE", -800, "visa"),
    ];
    const out = deriveSourceBreakdown(r, txns, ["amex", "visa"]);
    expect(out.bySource[0]?.label).toBe("visa");
    expect(out.bySource[1]?.label).toBe("amex");
  });
});
