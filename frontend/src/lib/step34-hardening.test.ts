/**
 * STEP 34 — analytical correctness, edge cases & data-integrity hardening.
 *
 * Pipeline-level fixtures (parse -> quality -> merchant -> classification ->
 * recurring -> software -> review -> report -> persistence -> export). All
 * fixtures are synthetic. Documents the preserved behaviors that are currently
 * intentional:
 *   - recurring detection is pure pattern-based and category-agnostic (a clean
 *     monthly delivery/grocery merchant WILL flag as likely_recurring);
 *   - XLSX reads only the first sheet and the first meaningful row is its header;
 *   - ambiguous MM/DD dates default to US order and emit AMBIGUOUS_DATE.
 */
import { describe, expect, it } from "vitest";
import type { NormalizedTransaction } from "./parse/types";
import type { MerchantIdentity, NormalizedTransactionWithMerchant } from "./merchant/types";
import { inspectDataQuality } from "./quality";
import { normalizeMerchants } from "./merchant";
import { classifyMerchants } from "./classification";
import { analyzeMerchant, detectRecurring } from "./recurring";
import { aggregateSoftwareSpend } from "./software";
import { detectSpendReviews } from "./leak";
import { buildReport, reportFilename, serializeReportCsv, serializeReportJson } from "./report";
import type { SasscoutReport } from "./report/types";
import { createSavedAnalysis, isSerializableAnalysis, schemaCompatible } from "./persistence";

function txn(id: string, date: string | null, description: string, amount: number): NormalizedTransaction {
  return { id, date, description, amount, sourceRow: Number(id.replace(/\D/g, "") || 100) };
}

function runReport(txns: NormalizedTransaction[], generatedAt = "2026-01-15T10:00:00.000Z") {
  const quality = inspectDataQuality(txns);
  const merchantResult = normalizeMerchants(txns);
  const classificationResult = classifyMerchants(merchantResult.merchants);
  const recurringResult = detectRecurring(merchantResult.transactions);
  const softwareResult = aggregateSoftwareSpend(
    merchantResult.transactions,
    classificationResult.merchants,
    recurringResult.patterns,
  );
  const reviewResult = detectSpendReviews(softwareResult.merchants, quality);
  const report = buildReport(
    {
      parse: {
        file: { name: "synthetic.csv" },
        transactions: txns,
        totalRows: txns.length,
        parsedRows: txns.length,
        skippedRows: 0,
        errors: [],
        warnings: [],
        columns: {},
        columnDiagnostics: { detected: {}, missing: [], ambiguous: [] },
        currency: null,
      },
      quality,
      classification: classificationResult,
      recurring: recurringResult,
      software: softwareResult,
      review: reviewResult,
    },
    { generatedAt },
  );
  return { report, merchantResult, classificationResult, softwareResult, quality };
}

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

function mtx(id: string, key: string, date: string, amount: number): NormalizedTransactionWithMerchant {
  return { id, date, description: key, amount, sourceRow: 1, merchant: identity(key, key) };
}

// ────────────────────────────────────────────────────────────────────────────
// Classification fixtures (positive / negative / ambiguous / unknown)
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — classification fixtures", () => {
  const cases: Array<{ desc: string; expected: string }> = [
    { desc: "ADOBE *CREATIVE CLOUD", expected: "likely_software" },
    { desc: "SLACK TECHNOLOGIES INC", expected: "likely_saas" },
    { desc: "FIGMA", expected: "likely_saas" },
    { desc: "MICROSOFT 365 SUBSCRIPTION", expected: "likely_saas" },
    { desc: "GROCERY STORE", expected: "not_software" },
    { desc: "SHELL FUEL", expected: "not_software" },
    { desc: "FRED'S RESTAURANT", expected: "not_software" },
    { desc: "AMAZON.COM", expected: "unknown" },
    { desc: "PAYPAL", expected: "unknown" },
    { desc: "XYZ CORP UNKNOWN SERVICE", expected: "unknown" },
  ];

  const txns = cases.map((c, i) => txn(`c${i}`, `2026-03-0${(i % 9) + 1}`, c.desc, -(i + 1)));
  const merchantResult = normalizeMerchants(txns);
  const classified = classifyMerchants(merchantResult.merchants).merchants;

  const canonical = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, " ");

  for (const c of cases) {
    it(`classifies "${c.desc}" as ${c.expected}`, () => {
      const merchant = classified.find((m) =>
        m.distinctRawDescriptions.some((d) => canonical(d) === canonical(c.desc)),
      );
      expect(merchant, `merchant for "${c.desc}" should exist`).toBeTruthy();
      expect(merchant?.classification.category).toBe(c.expected);
    });
  }

  it("classification counts are internally consistent", () => {
    const summary = classifyMerchants(normalizeMerchants(txns).merchants).summary;
    expect(summary.totalClassified).toBe(summary.likelySaasCount + summary.likelySoftwareCount + summary.notSoftwareCount + summary.unknownCount);
    expect(summary.likelySaasCount + summary.likelySoftwareCount).toBeGreaterThanOrEqual(4);
    expect(summary.notSoftwareCount).toBeGreaterThanOrEqual(3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Recurring detection fixtures (positives + preserved false positives)
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — recurring fixtures", () => {
  it("detects a stable monthly pattern", () => {
    const p = analyzeMerchant([
      mtx("1", "adobe", "2026-01-05", -1499),
      mtx("2", "adobe", "2026-02-05", -1499),
      mtx("3", "adobe", "2026-03-05", -1499),
      mtx("4", "adobe", "2026-04-05", -1499),
    ]);
    expect(p.status).toBe("likely_recurring");
    expect(p.interval).toBe("monthly");
    expect(p.confidence).toBe("high");
  });

  it("flags a price-drifting monthly pattern as possibly_recurring", () => {
    const p = analyzeMerchant([
      mtx("1", "m", "2026-01-05", -10),
      mtx("2", "m", "2026-02-05", -15),
      mtx("3", "m", "2026-03-05", -12),
      mtx("4", "m", "2026-04-05", -11),
    ]);
    expect(p.status).toBe("possibly_recurring");
    expect(p.interval).toBe("monthly");
  });

  it("counts a missing month as a gap, not a break", () => {
    const p = analyzeMerchant([
      mtx("1", "m", "2026-01-05", -10),
      mtx("2", "m", "2026-02-05", -10),
      mtx("3", "m", "2026-04-05", -10),
      mtx("4", "m", "2026-05-05", -10),
    ]);
    expect(p.status).toBe("likely_recurring");
    expect(p.gapCount).toBe(1);
  });

  it("recognizes an annual pattern", () => {
    const p = analyzeMerchant([
      mtx("1", "a", "2023-05-01", -100),
      mtx("2", "a", "2024-05-01", -100),
      mtx("3", "a", "2025-05-01", -100),
      mtx("4", "a", "2026-05-01", -100),
    ]);
    expect(p.status).toBe("likely_recurring");
    expect(p.interval).toBe("annual");
  });

  it("needs at least two payments before any pattern", () => {
    const p = analyzeMerchant([mtx("1", "adobe", "2026-01-05", -10)]);
    expect(p.status).toBe("insufficient_data");
  });

  it("calls irregular gaps not_recurring", () => {
    const p = analyzeMerchant([
      mtx("1", "x", "2026-01-01", -10),
      mtx("2", "x", "2026-01-20", -10),
      mtx("3", "x", "2026-03-15", -10),
    ]);
    expect(p.status).toBe("not_recurring");
    expect(p.interval).toBe("irregular");
  });

  it("excludes refunds from payment counts", () => {
    const p = analyzeMerchant([
      mtx("1", "adobe", "2026-01-05", -10),
      mtx("2", "adobe", "2026-02-05", -10),
      mtx("3", "adobe", "2026-03-05", -10),
      mtx("4", "adobe", "2026-03-06", 10),
    ]);
    expect(p.transactionCount).toBe(3);
    expect(p.status).toBe("likely_recurring");
  });

  it("deduplicates exact repeat rows before counting", () => {
    const p = analyzeMerchant([
      mtx("1", "adobe", "2026-01-05", -10),
      mtx("2", "adobe", "2026-01-05", -10),
      mtx("3", "adobe", "2026-02-05", -10),
      mtx("4", "adobe", "2026-03-05", -10),
    ]);
    expect(p.transactionCount).toBe(3);
  });

  it("docments present behavior: pure-pattern groceries flag as recurring", () => {
    // Known limitation, intentionally not fixed: recurring detection is
    // merchant-agnostic. A clean monthly pattern on a grocery flags as
    // likely_recurring even though classification labels the merchant
    // not_software. Do not "fix" without a requirement; it is documented here.
    const p = analyzeMerchant([
      mtx("1", "whole-foods", "2026-01-20", -42.1),
      mtx("2", "whole-foods", "2026-02-20", -42.1),
      mtx("3", "whole-foods", "2026-03-20", -42.1),
      mtx("4", "whole-foods", "2026-04-20", -42.1),
    ]);
    expect(p.status).toBe("likely_recurring");
    expect(p.interval).toBe("monthly");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Software aggregation fixtures (refunds, zeros, duplicates, multi-merchant)
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — aggregation fixtures", () => {
  const adobe = [
    txn("t1", "2026-01-05", "ADOBE *CREATIVE CLOUD", -59.99),
    txn("t2", "2026-02-05", "ADOBE *CREATIVE CLOUD", -59.99),
    txn("t3", "2026-03-05", "ADOBE *CREATIVE CLOUD", -59.99),
    txn("t4", "2026-03-10", "ADOBE REFUND", 59.99),
    txn("t5", "2026-03-11", "ADOBE *CREATIVE CLOUD", 0),
  ];

  it("counts only money out: refunds and zeros never add to spend", () => {
    const { softwareResult } = runReport(adobe);
    const adobeM = softwareResult.merchants.find((m) => m.normalizedKey === "adobe");
    expect(adobeM?.totalSpend).toBeCloseTo(179.97, 2);
    expect(softwareResult.summary.totalSoftwareSpend).toBeCloseTo(179.97, 2);
    expect(adobeM?.transactionCount).toBe(3);
  });

  it("does not double-count an exact repeat row", () => {
    const { softwareResult } = runReport([...adobe, txn("t6", "2026-01-05", "ADOBE *CREATIVE CLOUD", -59.99)]);
    const adobeM = softwareResult.merchants.find((m) => m.normalizedKey === "adobe");
    expect(adobeM?.totalSpend).toBeCloseTo(179.97, 2);
    expect(adobeM?.transactionCount).toBe(3);
  });

  it("sums across multiple software merchants without leakage", () => {
    const { softwareResult } = runReport([
      ...adobe,
      txn("s1", "2026-01-10", "SLACK", -8),
      txn("s2", "2026-02-10", "SLACK", -8),
      txn("s3", "2026-03-10", "SLACK", -8),
      txn("s4", "2026-04-10", "SLACK", -8),
    ]);
    expect(softwareResult.summary.totalSoftwareSpend).toBeCloseTo(179.97 + 32, 2);
    expect(softwareResult.summary.softwareMerchantCount).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Scoring boundaries (quality)
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — scoring boundaries", () => {
  const GOOD = Array.from({ length: 12 }, (_, i) =>
    txn(`g${i}`, `2026-${String((i % 6) + 1).padStart(2, "0")}-15`, i % 2 ? "ADOBE *CREATIVE CLOUD" : "SLACK", -59.99),
  );
  const BAD = Array.from({ length: 12 }, (_, i) => txn(`b${i}`, null, "", 0));
  // Realistic mixed file: good rows plus rows with null dates / blank descriptions.
  const MIXED = [...GOOD, ...BAD];

  it("scores stay within [0, 100] and use the documented levels", () => {
    for (const rows of [GOOD, BAD]) {
      const q = inspectDataQuality(rows);
      expect(q.score).toBeGreaterThanOrEqual(0);
      expect(q.score).toBeLessThanOrEqual(100);
      expect(["Good", "Fair", "Needs attention"]).toContain(q.level);
    }
  });

  it("ranks a complete dataset above a mostly-missing one", () => {
    const good = inspectDataQuality(GOOD);
    const bad = inspectDataQuality(BAD);
    expect(good.score).toBeGreaterThan(bad.score);
    expect(bad.level).not.toBe("Good");
  });

  it("tracks missing dates and zero amounts deterministically", () => {
    const q = inspectDataQuality(BAD);
    expect(q.date.missing).toBe(12);
    expect(q.amount.zero).toBe(12);
    expect(q.validTransactions).toBe(0);
  });

  it("never produces negative counts or non-finite numbers from mixed input", () => {
    const report = runReport(MIXED).report;
    assertReportNumericHygiene(report);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Report integrity (determinism, serialization, no raw rows, numeric hygiene)
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — report integrity & determinism", () => {
  const MIXED = () => [
    txn("t1", "2026-01-05", "ADOBE *CREATIVE CLOUD", -59.99),
    txn("t2", "2026-02-05", "ADOBE *CREATIVE CLOUD", -59.99),
    txn("t3", "2026-03-05", "ADOBE *CREATIVE CLOUD", -59.99),
    txn("t4", "2026-04-05", "ADOBE REFUND", 59.99),
    txn("t5", "2026-01-10", "SLACK", -8),
    txn("t6", "2026-02-10", "SLACK", -8),
    txn("t7", "2026-01-20", "GROCERY STORE", -42.1),
    txn("t8", "2026-02-20", "GROCERY STORE", -35.2),
    txn("t9", "2026-01-01", "XYZ CORP UNKNOWN SERVICE", -199),
    txn("t10", null, "MYSTERY CHARGE", -15),
  ];

  it("is deterministic: same input yields byte-identical JSON", () => {
    const a = runReport(MIXED(), "2026-06-01T00:00:00.000Z").report;
    const b = runReport(MIXED(), "2026-06-01T00:00:00.000Z").report;
    expect(serializeReportJson(a)).toBe(serializeReportJson(b));
  });

  it("is content-independent of the input row order", () => {
    const a = runReport(MIXED(), "2026-06-01T00:00:00.000Z").report;
    const shuffled = [...MIXED()].reverse();
    const b = runReport(shuffled, "2026-06-01T00:00:00.000Z").report;
    // Values must match; within equal-count tie groups the merchant ordering
    // follows first-seen (i.e. input order), so compare canonical content.
    expect(canonicalReport(a)).toBe(canonicalReport(b));
  });

  it("never leaks raw transaction rows into the report", () => {
    const { report } = runReport(MIXED());
    const SHAPE = [
      "normalizedKey", "merchantName", "transactionCount", "firstSeen", "lastSeen",
      "distinctRawDescriptions", "classification", "recurring", "softwareStatus",
      "totalSpend", "typicalTransactionAmount", "estimatedMonthlySpend",
      "estimatedYearlySpend", "review",
    ];
    for (const m of report.merchants) {
      expect(Object.keys(m).sort()).toEqual([...SHAPE].sort());
    }
  });

  it("has no NaN/Infinity in JSON and no negative numeric fields", () => {
    const { report } = runReport(MIXED());
    const json = serializeReportJson(report);
    expect(json).not.toMatch(/NaN|Infinity/);
    assertReportNumericHygiene(report);
  });

  it("round-trips through JSON.parse", () => {
    const { report } = runReport(MIXED());
    const parsed = JSON.parse(serializeReportJson(report)) as SasscoutReport;
    expect(parsed.reportVersion).toBe(1);
    expect(parsed.merchants).toHaveLength(report.merchants.length);
    expect(parsed.softwareSpend.totalSoftwareSpend).toBe(report.softwareSpend.totalSoftwareSpend);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Invariants (add/remove unrelated rows)
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — invariants", () => {
  it("adding an unrelated merchant does not change existing merchant totals", () => {
    const base = [
      txn("t1", "2026-01-05", "ADOBE *CREATIVE CLOUD", -59.99),
      txn("t2", "2026-02-05", "ADOBE *CREATIVE CLOUD", -59.99),
    ];
    const baseReport = runReport(base).report;
    const extended = runReport([...base, txn("t3", "2026-03-01", "NEW ONLINE STORE", -20)]).report;
    const baseAdobe = baseReport.merchants.find((m) => m.normalizedKey === "adobe");
    const extAdobe = extended.merchants.find((m) => m.normalizedKey === "adobe");
    expect(extAdobe?.totalSpend).toBe(baseAdobe?.totalSpend);
  });

  it("removing a transaction never increases that merchant's spend", () => {
    const more = [
      txn("t1", "2026-01-05", "ADOBE *CREATIVE CLOUD", -59.99),
      txn("t2", "2026-02-05", "ADOBE *CREATIVE CLOUD", -59.99),
    ];
    const fewer = [txn("t1", "2026-01-05", "ADOBE *CREATIVE CLOUD", -59.99)];
    const a = runReport(more).report.merchants.find((m) => m.normalizedKey === "adobe")?.totalSpend ?? 0;
    const b = runReport(fewer).report.merchants.find((m) => m.normalizedKey === "adobe")?.totalSpend ?? 0;
    expect(b).toBeLessThanOrEqual(a);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Large synthetic dataset (3000 rows) — robustness + determinism
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — large dataset robustness", () => {
  const DESCRIPTIONS = [
    "ADOBE *CREATIVE CLOUD",
    "SLACK",
    "FIGMA",
    "WHOLE FOODS MARKET",
    "CAFE LATTE",
    "XYZ STUDIO",
  ];

  function bigFixture(): NormalizedTransaction[] {
    const rows: NormalizedTransaction[] = [];
    for (let i = 0; i < 3000; i++) {
      const date = new Date(2025, 0, 1 + (i % 900)).toISOString().slice(0, 10);
      rows.push(txn(`big-${i}`, date, DESCRIPTIONS[i % DESCRIPTIONS.length], -(10 + (i % 997))));
    }
    return rows;
  }

  it("produces a finite, non-negative, correct report", () => {
    const rows = bigFixture();
    const { report, softwareResult } = runReport(rows, "2026-06-01T00:00:00.000Z");
    const expected = rows
      .filter((t) => ["ADOBE *CREATIVE CLOUD", "SLACK", "FIGMA"].includes(t.description))
      .reduce((sum, t) => sum - t.amount, 0);
    expect(softwareResult.summary.totalSoftwareSpend).toBe(expected);
    expect(report.softwareSpend.totalSoftwareSpend).toBe(expected);
    assertReportNumericHygiene(report);
  });

  it("is deterministic across repeated runs of the same fixture", () => {
    const rows = bigFixture();
    const a = runReport(rows, "2026-06-01T00:00:00.000Z").report;
    const b = runReport(rows, "2026-06-01T00:00:00.000Z").report;
    expect(serializeReportJson(a)).toBe(serializeReportJson(b));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Persistence integrity (create -> structured clone -> validate)
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — persistence integrity", () => {
  const { report } = runReport([
    txn("t1", "2026-01-05", "ADOBE *CREATIVE CLOUD", -59.99),
    txn("t2", "2026-02-05", "ADOBE *CREATIVE CLOUD", -59.99),
  ]);

  it("a saved analysis survives a structured clone with the report intact", () => {
    const saved = createSavedAnalysis(report, { id: "saved-34", now: "2026-06-01T00:00:00.000Z" });
    const cloned = structuredClone(saved);
    expect(isSerializableAnalysis(cloned)).toBe(true);
    expect(schemaCompatible(cloned)).toBe(true);
    expect(cloned.report).toEqual(report);
    expect(cloned.schemaVersion).toBe(1);
  });

  it("rejects malformed records", () => {
    expect(isSerializableAnalysis(null)).toBe(false);
    expect(isSerializableAnalysis("nope")).toBe(false);
    expect(isSerializableAnalysis({ id: "x", schemaVersion: 1 })).toBe(false);
    const bad = { id: "x", schemaVersion: 1, createdAt: "t", updatedAt: "t", name: "n", fileName: "f", report: null };
    expect(isSerializableAnalysis(bad)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Export integrity (CSV escaping / formula injection / JSON)
// ────────────────────────────────────────────────────────────────────────────
describe("STEP 34 — export integrity", () => {
  function merchant(name: string): SasscoutReport["merchants"][number] {
    return {
      normalizedKey: name.toLowerCase(),
      merchantName: name,
      transactionCount: 1,
      firstSeen: "2026-01-01",
      lastSeen: "2026-01-01",
      distinctRawDescriptions: [name],
      classification: { category: "unknown", confidence: "low", evidence: [{ type: "generic_merchant", message: "n/a" }] },
      recurring: null,
      softwareStatus: null,
      totalSpend: 5,
      typicalTransactionAmount: 5,
      estimatedMonthlySpend: null,
      estimatedYearlySpend: null,
      review: null,
    };
  }

  function reportWith(merchants: SasscoutReport["merchants"]): SasscoutReport {
    return {
      reportVersion: 1,
      generatedAt: "2026-01-15T10:00:00.000Z",
      file: { name: "txns.csv", totalRows: merchants.length, parsedRows: merchants.length, skippedRows: 0 },
      quality: {
        totalTransactions: merchants.length,
        validTransactions: merchants.length,
        date: { present: merchants.length, missing: 0, invalid: 0, earliest: "2026-01-01", latest: "2026-01-01" },
        description: { missing: 0, lowInformation: 0 },
        amount: { zero: 0, positive: merchants.length, negative: 0 },
        duplicates: { exact: 0, possible: 0 },
        coverage: { dateRangeDays: 1, monthsRepresented: 1, transactionsByMonth: {} },
        score: 100,
        level: "Good",
        analysisReadiness: "ready",
        warnings: [],
      },
      classification: {
        likelySaasCount: 0, likelySoftwareCount: 0, notSoftwareCount: 0,
        unknownCount: merchants.length, totalClassified: merchants.length, needsReview: merchants.length,
      },
      softwareSpend: {
        totalSoftwareSpend: 0, estimatedMonthlySpend: 0, estimatedYearlySpend: 0,
        softwareMerchantCount: 0, recurringSoftwareMerchantCount: 0, nonRecurringSoftwareMerchantCount: 0,
        uncertainMerchantCount: merchants.length, topSoftwareByTotal: [], topRecurringByMonthly: [],
      },
      review: {
        strongReviewCount: 0, reviewCount: 0, noConcernCount: 0, insufficientEvidenceCount: merchants.length,
        estimatedMonthlyReviewSpend: 0, estimatedYearlyReviewSpend: 0,
      },
      currency: null,
      merchants,
    };
  }

  it("prefixes cells that would start with a formula character", () => {
    const csv = serializeReportCsv(reportWith([merchant("=SUM(A1)"), merchant("+1-1"), merchant("-2+3"), merchant("@import")]));
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain("'+1-1");
    expect(csv).toContain("'-2+3");
    expect(csv).toContain("'@import");
    expect(csv).not.toContain("\r\n=SUM(A1),");
  });

  it("escapes quotes, commas and unicode and round-trips the header", () => {
    const csv = serializeReportCsv(reportWith([merchant('Acme, "Test" Δ 测试')]));
    expect(csv).toContain('"Acme, ""Test"" Δ 测试"');
    expect(csv.startsWith("Merchant,")).toBe(true);
  });

  it("serializes JSON faithfully and names files deterministically from generatedAt", () => {
    const report = reportWith([merchant("Acme")]);
    const parsed = JSON.parse(serializeReportJson(report)) as SasscoutReport;
    expect(parsed.generatedAt).toBe("2026-01-15T10:00:00.000Z");
    expect(parsed.merchants[0].merchantName).toBe("Acme");
    expect(reportFilename(report, "csv")).toBe("sasscout-report-2026-01-15.csv");
    expect(reportFilename(report, "json")).toBe("sasscout-report-2026-01-15.json");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Shared numeric hygiene walker
// ────────────────────────────────────────────────────────────────────────────
function assertReportNumericHygiene(value: unknown, path = "report"): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value), `${path} must be finite`).toBe(true);
    expect(value, `${path} must be non-negative`).toBeGreaterThanOrEqual(0);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertReportNumericHygiene(v, `${path}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(value)) assertReportNumericHygiene(v, `${path}.${k}`);
}

function canonicalReport(report: SasscoutReport): string {
  // Sort object keys and array elements so the comparison is insensitive to
  // first-seen ordering (transactionsByMonth key order, distinctRawDescriptions
  // order, tie-group merchant order). Only used to compare two runs of the same
  // dataset, so ordering is presentation, not content.
  function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(canonicalize).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    if (value !== null && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => [k, canonicalize(v)] as const)
        .sort((a, b) => a[0].localeCompare(b[0]));
      return Object.fromEntries(entries);
    }
    return value;
  }
  return JSON.stringify(canonicalize(report));
}