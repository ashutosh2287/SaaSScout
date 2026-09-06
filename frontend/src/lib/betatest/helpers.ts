import type { NormalizedTransaction, ParseResult } from "../parse/types";
import type { SasscoutReport } from "../report/types";
import { compareReports } from "../compare/engine";
import { analyzeParseResult, type AnalysisSnapshot } from "./pipeline";

export function buildReportFor(txns: NormalizedTransaction[], fileName: string): SasscoutReport {
  const parseResult: ParseResult = {
    file: { name: fileName },
    transactions: txns,
    totalRows: txns.length,
    parsedRows: txns.length,
    skippedRows: 0,
    errors: [],
    warnings: [],
    columns: {},
    columnDiagnostics: { detected: {}, missing: [], ambiguous: [] },
  };
  return analyzeParseResult(parseResult).report;
}

export function snapshotFor(txns: NormalizedTransaction[], fileName: string): AnalysisSnapshot {
  const parseResult: ParseResult = {
    file: { name: fileName },
    transactions: txns,
    totalRows: txns.length,
    parsedRows: txns.length,
    skippedRows: 0,
    errors: [],
    warnings: [],
    columns: {},
    columnDiagnostics: { detected: {}, missing: [], ambiguous: [] },
  };
  return analyzeParseResult(parseResult);
}

export type ComplexCompareResult = ReturnType<typeof compareReports>;

export function runCompare(a: SasscoutReport, b: SasscoutReport): ComplexCompareResult {
  return compareReports(a, b, { baseline: "baseline.csv", current: "current.csv" });
}