/**
 * STEP 35 — performance & scaling stress.
 *
 * Drives the full analytical pipeline (parse -> quality -> merchant ->
 * classification -> recurring -> software -> review -> report ->
 * persistence-validation) at 100 / 1,000 / 3,000 / 10,000 / 25,000 rows and
 * asserts correctness, determinism, and numeric hygiene at every size. Time
 * bounds are intentionally generous to avoid flakiness on slow machines; the
 * gate is "completes correctly at each size", not an arbitrary ms budget.
 */
import { describe, expect, it } from "vitest";
import type { NormalizedTransaction } from "./parse/types";
import { inspectDataQuality } from "./quality";
import { normalizeMerchants } from "./merchant";
import { classifyMerchants } from "./classification";
import { detectRecurring } from "./recurring";
import { aggregateSoftwareSpend } from "./software";
import { detectSpendReviews } from "./leak";
import { buildReport } from "./report";
import { createSavedAnalysis, isReadableSavedAnalysis } from "./persistence";

const DESCRIPTIONS = [
  "ADOBE CREATIVE CLOUD",
  "SLACK TECHNOLOGIES INC",
  "MICROSOFT 365 SUBSCRIPTION",
  "FIGMA",
  "GITHUB INC",
  "AWS AMAZON WEB SERVICES",
  "GOOGLE WORKSPACE",
  "NETFLIX.COM",
  "SPOTIFY AB",
  "NOTION LABS",
  "ATLASSIAN CLOUD",
  "DOCKER SUBSCRIPTION",
];
const MERCHANT_COUNT = DESCRIPTIONS.length;

function txn(id: string, date: string | null, description: string, amount: number, sourceRow: number): NormalizedTransaction {
  return { id, date, description, amount, sourceRow };
}

function fixture(count: number): NormalizedTransaction[] {
  const rows: NormalizedTransaction[] = [];
  // 12 months of 28-day months, 3 transactions per merchant per month.
  for (let i = 0; i < count; i++) {
    const day = (i % 28) + 1;
    const month = (Math.floor(i / (MERCHANT_COUNT * 3)) % 12) + 1;
    const date = `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    rows.push(
      txn(`t${i}`, date, DESCRIPTIONS[i % MERCHANT_COUNT], -(10 + (i % 997)), 1000 + i),
    );
  }
  return rows;
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
      },
      quality,
      classification: classificationResult,
      recurring: recurringResult,
      software: softwareResult,
      review: reviewResult,
    },
    { generatedAt },
  );
  return { report, softwareResult, quality };
}

function assertAllFinite(value: unknown, path: string): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value), `non-finite number at ${path}`).toBe(true);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertAllFinite(v, `${path}[${i}]`));
  } else if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      assertAllFinite((value as Record<string, unknown>)[key], `${path}.${key}`);
    }
  }
}

const SIZES = [100, 1000, 3000, 10000, 25000];

// Generous per-test budgets: a 25,000-row pipeline run measures ~20s on this
// machine, so anything less than MINUTES * count/10000 would be flaky.
function budget(count: number): number {
  return count >= 10000 ? 120_000 : 30_000;
}

for (const count of SIZES) {
  describe(`STEP 35 — ${count.toLocaleString()} rows`, () => {
    const rows = fixture(count);

    it(
      "runs the full pipeline with correct counts and no non-finite numbers",
      () => {
        const { report } = runReport(rows);
        expect(report.file.parsedRows).toBe(count);
        expect(report.file.skippedRows).toBe(0);
        expect(report.merchants.length).toBe(MERCHANT_COUNT);
        expect(report.quality.totalTransactions).toBe(count);
        assertAllFinite(report, "report");
      },
      budget(count),
    );

    it(
      "is deterministic: two runs produce byte-identical reports",
      () => {
        const a = runReport(rows).report;
        const b = runReport(rows).report;
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      },
      budget(count),
    );

    it(
      "passes the persistence read-path validator (cross-layer contract)",
      () => {
        const { report } = runReport(rows);
        const saved = createSavedAnalysis(report, {
          id: "perf-1",
          now: "2026-01-15T10:00:00.000Z",
        });
        expect(isReadableSavedAnalysis(saved)).toBe(true);
      },
      budget(count),
    );
  });
}