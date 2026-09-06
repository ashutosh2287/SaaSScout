import { describe, expect, it } from "vitest";
import { buildStatement, toCsv, rowsToTransactions, splitWindows } from "./fixtures";
import { parseAndAnalyze } from "./pipeline";
import { buildReportFor, runCompare } from "./helpers";

function shiftDate(iso: string, days: number): string {
  const d = new Date(Date.parse(iso));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Deterministic N-row CSV: cycles the realistic statement, pushing each cycle's
// dates forward so nothing collapses into exact duplicates.
function scaledCsv(n: number, statement = buildStatement()): string {
  const out = [];
  const base = statement.rows;
  for (let i = 0; i < n; i++) {
    const r = base[i % base.length];
    const shift = Math.floor(i / base.length);
    out.push({ ...r, date: shiftDate(r.date, shift * 7) });
  }
  return toCsv(out, ["Date", "Description", "Amount"]);
}

describe("STEP 20 — performance at real-world scale (file parse + analysis)", () => {
  const sizes = [1000, 5000, 10000, 25000];
  const results: { rows: number; parseMs: number; analyzeMs: number }[] = [];

  for (const n of sizes) {
    it(`parses and analyzes ${n} rows end-to-end`, async () => {
      const csv = scaledCsv(n);
      const t0 = performance.now();
      const snapshot = await parseAndAnalyze(csv, `scale-${n}.csv`);
      const totalMs = Number((performance.now() - t0).toFixed(1));
      results.push({ rows: n, parseMs: totalMs, analyzeMs: totalMs });
      expect(snapshot.parse.errors).toEqual([]);
      expect(snapshot.parse.parsedRows).toBe(n);
      expect(snapshot.report.softwareSpend.totalSoftwareSpend).toBeGreaterThan(0);
      // Generous budgets; the point is bounded, non-explosive scaling.
      expect(totalMs).toBeLessThan(8000);
      console.log(`perf ${n}: end-to-end ${totalMs}ms`);
    }, 30000);
  }

  it("scales near-linearly (25k not more than 12x a 1k run)", () => {
    const r1k = results.find((r) => r.rows === 1000);
    const r25k = results.find((r) => r.rows === 25000);
    if (r1k && r25k) {
      const ratio = r25k.analyzeMs / Math.max(1, r1k.analyzeMs);
      console.log(`perf scaling: 25k/1k ratio = ${ratio.toFixed(1)}x`);
      expect(ratio).toBeLessThan(12);
    } else {
      expect.fail("performance measurements missing");
    }
  });

  it("keeps the full compare path healthy at 25k rows", async () => {
    const rows = scaledCsvRows(25000);
    const all = rowsToTransactions(rows);
    const { baseline, current } = splitWindows(all);
    const a = buildReportFor(baseline, "baseline.csv");
    const b = buildReportFor(current, "current.csv");
    const r = runCompare(a, b);
    expect(r.findings.length).toBeGreaterThan(0);
  }, 30000);
});

function scaledCsvRows(n: number, statement = buildStatement()) {
  const out = [];
  const base = statement.rows;
  for (let i = 0; i < n; i++) {
    const r = base[i % base.length];
    const shift = Math.floor(i / base.length);
    out.push({ ...r, date: shiftDate(r.date, shift * 7) });
  }
  return out;
}