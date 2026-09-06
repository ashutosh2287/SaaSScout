import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseFile } from "../parse";
import {
  buildStatement,
  toCsv,
  splitWindows,
  rowsToTransactions,
  SOFTWARE_EXPECTED_KEYS,
  NON_SOFTWARE_EXPECTED_KEYS,
  AMBIGUOUS_EXPECTED_KEYS,
  RECURRING_MONTHLY_KEYS,
  RECURRING_QUARTERLY_KEYS,
} from "./fixtures";
import { parseAndAnalyze, analyzeParseResult, classificationByKey } from "./pipeline";
import { buildReportFor, runCompare } from "./helpers";

const SOFTWARE_CATEGORIES = new Set(["likely_saas", "likely_software"]);

describe("STEP 20 — real-world SMB statement through the real file path", () => {
  const statement = buildStatement();
  const csv = toCsv(statement.rows, ["Date", "Description", "Amount"]);
  const metrics = {
    rowCount: statement.rows.length,
    baseline: statement.baselineRows.length,
    current: statement.currentRows.length,
    parsed: 0,
    errors: 0,
    tp: 0,
    fp: 0,
    fn: 0,
    softwareClassified: 0,
    recurringMonthlyHit: 0,
    recurringQuarterlyHit: 0,
    comparisonFindings: [] as string[],
    timeAnalysisMs: 0,
  };

  it("builds a 5k+ row realistic statement with balanced windows", () => {
    expect(metrics.rowCount).toBeGreaterThanOrEqual(5000);
    expect(statement.baselineRows.length).toBeGreaterThanOrEqual(2000);
    expect(statement.currentRows.length).toBeGreaterThanOrEqual(2000);
    const netflix = statement.rows.filter((r) => r.description.includes("NETFLIX"));
    const atlas = statement.rows.filter((r) => r.description.includes("ATLASSIAN"));
    const sf = statement.rows.filter((r) => r.description.includes("SALESFORCE"));
    expect(netflix.length).toBeGreaterThanOrEqual(11);
    expect(atlas.length).toBeGreaterThanOrEqual(5);
    expect(sf.length).toBeGreaterThanOrEqual(5);
  });

  it("parses the full CSV with zero errors", async () => {
    const parseResult = await parseFile(new File([csv], "smb-statement.csv", { type: "text/csv" }));
    metrics.parsed = parseResult.parsedRows;
    metrics.errors = parseResult.errors.length;
    expect(parseResult.errors).toEqual([]);
    expect(parseResult.parsedRows).toBe(statement.rows.length);
    expect(parseResult.totalRows).toBe(statement.rows.length);
    expect(parseResult.columns.date).toBeTruthy();
    expect(parseResult.columns.description).toBeTruthy();
    expect(parseResult.columns.amount).toBeTruthy();
    // Every parsed transaction must have a real date and a negative-spend amount.
    for (const t of parseResult.transactions.slice(0, 500)) {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.amount).toBeLessThan(0);
    }
  });

  it("classifies software with precision 1.0, recall 1.0 against ground truth", async () => {
    const started = performance.now();
    const snapshot = await parseAndAnalyze(csv, "smb-statement.csv");
    metrics.timeAnalysisMs = Number((performance.now() - started).toFixed(1));
    const byKey = classificationByKey(snapshot);

    const txnTriple = new Map<string, string>();
    for (let i = 0; i < statement.rows.length; i++) {
      const r = statement.rows[i];
      txnTriple.set(`${r.date}|${r.description}|${r.amount}`, statement.seedByRowIndex[i] ?? "noise");
    }

    // Precision: no non-software or ambiguous seed may end up in a software-
    // classified merchant identity.
    const protectedSeeds = new Set([
      ...NON_SOFTWARE_EXPECTED_KEYS,
      ...AMBIGUOUS_EXPECTED_KEYS,
    ]);
    const identityOf = new Map<string, string>();
    for (const t of snapshot.merchants.transactions) {
      identityOf.set(`${t.date}|${t.description}|${t.amount}`, t.merchant.normalizedKey ?? "");
    }
    const softwareIdentities = new Set<string>();
    for (const [key, cat] of byKey) {
      if (SOFTWARE_CATEGORIES.has(cat)) softwareIdentities.add(key);
    }
    for (const t of snapshot.merchants.transactions) {
      const triple = `${t.date}|${t.description}|${t.amount}`;
      const seed = txnTriple.get(triple);
      if (!seed || !protectedSeeds.has(seed)) continue;
      const identity = t.merchant.normalizedKey;
      if (identity && softwareIdentities.has(identity)) {
        metrics.fp += 1;
      }
    }
    // Recall: every expected software key appears and is classified software.
    const classifiedSoftwareKeys = new Set(byKey.keys());
    for (const key of SOFTWARE_EXPECTED_KEYS) {
      if (classifiedSoftwareKeys.has(key) && SOFTWARE_CATEGORIES.has(byKey.get(key)!)) {
        metrics.tp += 1;
      } else {
        metrics.fn += 1;
      }
    }
    metrics.softwareClassified = softwareIdentities.size;
    expect(metrics.fp, `unexpected non-software/ambiguous merchant classified as software`).toBe(0);
    expect(metrics.fn, `software ground truth keys missing: ${SOFTWARE_EXPECTED_KEYS.filter((k) => !classifiedSoftwareKeys.has(k) || !SOFTWARE_CATEGORIES.has(byKey.get(k)!)).join(", ")}`).toBe(0);

    // Report-level: aggregate must surface the spend story a user needs.
    expect(snapshot.software.summary.totalSoftwareSpend).toBeGreaterThan(0);
    expect(snapshot.software.summary.softwareMerchantCount).toBeGreaterThanOrEqual(SOFTWARE_EXPECTED_KEYS.length - 2);
    expect(snapshot.software.summary.estimatedMonthlySpend).toBeGreaterThan(0);
    expect(snapshot.software.summary.topSoftwareByTotal.length).toBeGreaterThan(0);
    expect(snapshot.software.summary.topRecurringByMonthly.length).toBeGreaterThan(0);
  });

  it("detects recurring cadence on the real statement (monthly & quarterly)", async () => {
    const snapshot = await parseAndAnalyze(csv, "smb-statement.csv");
    for (const key of RECURRING_MONTHLY_KEYS) {
      const p = snapshot.recurring.patterns.get(key);
      expect(p, `no recurring pattern for ${key}`).toBeDefined();
      if (!p) continue;
      const hit = p.interval === "monthly" && (p.status === "likely_recurring" || p.status === "possibly_recurring");
      if (hit) metrics.recurringMonthlyHit += 1;
      expect(p.transactionCount, `${key} monthly cadence count`).toBeGreaterThanOrEqual(2);
      expect(p.interval, `${key} should be monthly`).toBe("monthly");
      expect(["likely_recurring", "possibly_recurring"], `${key} status`).toContain(p.status);
    }
    for (const key of RECURRING_QUARTERLY_KEYS) {
      const p = snapshot.recurring.patterns.get(key);
      expect(p, `no recurring pattern for ${key}`).toBeDefined();
      if (!p) continue;
      expect(p.interval, `${key} should be quarterly`).toBe("quarterly");
      metrics.recurringQuarterlyHit += 1;
    }
    // Honesty ceiling: the irregular aws spend must never read as clean monthly.
    const aws = snapshot.recurring.patterns.get("aws");
    expect(aws).toBeDefined();
    if (aws) {
      expect(aws.interval, "aws irregular spend must not be claimed as monthly/quarterly").not.toBe("monthly");
      expect(aws.interval, "aws irregular spend must not be claimed as monthly/quarterly").not.toBe("quarterly");
    }
  });

  it("comparison flags the seeded real-world events", async () => {
    const all = rowsToTransactions(statement.rows);
    const { baseline, current } = splitWindows(all);
    const a = buildReportFor(baseline, "baseline.csv");
    const b = buildReportFor(current, "current.csv");
    const result = runCompare(a, b);
    metrics.comparisonFindings = result.findings.map((f: { kind: string; merchantKey: string }) => `${f.kind}:${f.merchantKey}`);

    const kinds = result.findings.map((f: { kind: string; merchantKey: string }) => `${f.kind}:${f.merchantKey}`);
    expect(kinds).toContain("ended_recurring:atlassian");
    expect(kinds).toContain("new_recurring:salesforce");
    const pi = result.findings.find((f: { kind: string; merchantKey: string }) => f.kind === "price_increase" && f.merchantKey === "netflix");
    expect(pi).toBeDefined();
    // The material price step must produce a high-confidence call: both windows
    // are cleanly recurring and amounts are stable.
    expect(pi && (pi as { confidence?: string }).confidence).toBe("high");
    expect(result.findings.length).toBeLessThan(15); // no finding explosion on a real statement
  });

  it("prints aggregate metrics for the report", () => {
    const precision = metrics.tp === 0 ? 1 : metrics.tp / (metrics.tp + metrics.fp);
    const recall = metrics.tp === 0 ? 1 : metrics.tp / (metrics.tp + metrics.fn);
    console.log(
      `reality: rows=${metrics.rowCount} baseline=${metrics.baseline} current=${metrics.current}` +
        ` parsed=${metrics.parsed} errors=${metrics.errors}` +
        ` tp=${metrics.tp} fp=${metrics.fp} fn=${metrics.fn} precision=${precision.toFixed(3)} recall=${recall.toFixed(3)}` +
        ` software_identities=${metrics.softwareClassified} recurring_monthly_hit=${metrics.recurringMonthlyHit}` +
        ` recurring_quarterly_hit=${metrics.recurringQuarterlyHit}` +
        ` findings=[${metrics.comparisonFindings.join(", ")}] analysis_ms=${metrics.timeAnalysisMs}`,
    );
    expect(precision).toBe(1);
    expect(recall).toBe(1);
  });
});

describe("STEP 20 — format diversity end-to-end (real parseFile)", () => {
  it("handles a UTF-8 BOM prefix", async () => {
    const statement = buildStatement();
    const csv = "\uFEFF" + toCsv(statement.rows, ["Date", "Description", "Amount"]);
    const p = await parseFile(new File([csv], "bom.csv", { type: "text/csv" }));
    expect(p.errors).toEqual([]);
    expect(p.parsedRows).toBe(statement.rows.length);
    expect(p.columns.description).toBeTruthy();
  });

  it("handles reordered columns plus extra columns", async () => {
    const statement = buildStatement();
    const rows = [
      ["Amount", "Description", "Date", "Account", "Type"],
      ...statement.rows.slice(0, 1200).map((r) => [r.amount.toFixed(2), r.description, r.date, "checking", "DEBIT"]),
    ];
    const csv = rows.map((r) => r.map((c) => (typeof c === "string" && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
    const p = await parseFile(new File([csv], "columns.csv", { type: "text/csv" }));
    expect(p.errors).toEqual([]);
    expect(p.parsedRows).toBe(1200);
    expect(p.columns.date).toBeTruthy();
    expect(p.columns.description).toBeTruthy();
    expect(p.columns.amount).toBeTruthy();
  });

  it("handles debit/credit column pairs", async () => {
    const statement = buildStatement();
    const rows: string[][] = [["Date", "Description", "Debit", "Credit"]];
    for (const r of statement.rows.slice(0, 600)) {
      rows.push([r.date, r.description, (-r.amount).toFixed(2), ""]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const p = await parseFile(new File([csv], "debitcredit.csv", { type: "text/csv" }));
    expect(p.errors).toEqual([]);
    expect(p.parsedRows).toBe(600);
    for (const t of p.transactions.slice(0, 20)) expect(t.amount).toBeLessThan(0);
  });

  it("skips bank-style blank and TOTAL/summary rows", async () => {
    const statement = buildStatement();
    const body: string[][] = [];
    for (const r of statement.rows.slice(0, 800)) {
      body.push([r.date, r.description, r.amount.toFixed(2)]);
      body.push(["", "", ""]);
      if (body.length % 100 === 50) body.push(["TOTAL", "", (r.amount - 1).toFixed(2)]);
    }
    body.push(["GRAND TOTAL", "", "0.00"]);
    const csv = [["Date", "Description", "Amount"], ...body].map((r) => r.join(",")).join("\n");
    const p = await parseFile(new File([csv], "totals.csv", { type: "text/csv" }));
    expect(p.errors).toEqual([]);
    expect(p.parsedRows).toBe(800);
  });

  it("parses a real .xlsx workbook (Date cells, numeric amounts)", async () => {
    const statement = buildStatement();
    const aoa: unknown[][] = [["Date", "Description", "Amount"]];
    for (const r of statement.rows.slice(0, 1200)) {
      const [y, m, d] = r.date.split("-").map(Number);
      aoa.push([new Date(Date.UTC(y, m - 1, d)), r.description, r.amount]);
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Transactions");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const p = await parseFile(new File([buf], "smb.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    expect(p.errors).toEqual([]);
    expect(p.parsedRows).toBe(1200);
    expect(p.columns.date).toBeTruthy();
    expect(p.columns.amount).toBeTruthy();
    for (const t of p.transactions.slice(0, 20)) {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.amount).toBeLessThan(0);
    }
  });

  it("reports a controlled EMPTY_FILE for an empty first xlsx sheet", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), "Empty");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const p = await parseFile(new File([buf], "empty.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    expect(p.transactions).toEqual([]);
    expect(p.errors.some((e) => e.code === "EMPTY_FILE")).toBe(true);
  });
});

describe("STEP 20 — empty / low-data real-user states", () => {
  it("surfaces a controlled error for an empty CSV", async () => {
    const p = await parseFile(new File([""], "empty.csv", { type: "text/csv" }));
    expect(p.transactions).toEqual([]);
    expect(p.errors.map((e) => e.code)).toContain("EMPTY_FILE");
  });

  it("surfaces a controlled error when columns are unrecognized", async () => {
    const p = await parseFile(new File(["Item,Price\ncoffee,5\n"], "noamount.csv", { type: "text/csv" }));
    expect(p.transactions).toEqual([]);
    // Every row yields a controlled INVALID_AMOUNT (no amount column found);
    // the file is rejected without ever throwing into the caller.
    expect(p.errors.every((e) => ["INVALID_AMOUNT", "INVALID_DATE", "MISSING_AMOUNT_COLUMN"].includes(e.code))).toBe(true);
    expect(p.errors.length).toBeGreaterThan(0);
  });

  it("signals small/shallow datasets with honest warnings", async () => {
    const csv = ["Date,Description,Amount", "2026-06-01,NETFLIX,-15.49", "2026-06-02,GROCERY STORE,-45.00", "2026-06-03,COFFEE SHOP,-4.50"].join("\n");
    const snapshot = await parseAndAnalyze(csv, "tiny.csv");
    expect(snapshot.quality.totalTransactions).toBe(3);
    const codes = snapshot.quality.warnings.map((w) => w.code);
    expect(codes).toContain("SMALL_DATASET");
    expect(["needs_attention", "ready"]).toContain(snapshot.quality.analysisReadiness);
  });

  it("never blocks analysis on a slightly shallow but healthy file", async () => {
    const statement = buildStatement();
    const rows = statement.rows.filter((r) => r.date < "2025-08-01").slice(0, 60);
    const csv = toCsv(rows, ["Date", "Description", "Amount"]);
    const snapshot = await parseAndAnalyze(csv, "thin.csv");
    expect(snapshot.quality.analysisReadiness).not.toBe("blocked");
    expect(snapshot.report.softwareSpend.softwareMerchantCount).toBeGreaterThan(0);
  });

  it("empty analyze result is type-clean and actionable downstream", async () => {
    const empty = await parseFile(new File([""], "empty.csv", { type: "text/csv" }));
    const snapshot = analyzeParseResult(empty);
    expect(snapshot.report.merchants).toEqual([]);
    expect(snapshot.report.softwareSpend.softwareMerchantCount).toBe(0);
  });
});