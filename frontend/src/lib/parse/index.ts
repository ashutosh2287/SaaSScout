import { detectColumns } from "./columns";
import { parseCsvWithMeta } from "./csv";
import { buildHeaderIndex, normalizeRow, resetIdCounter } from "./normalize";
import type { ColumnMap, NormalizedTransaction, ParseError, ParseResult, ParseWarning } from "./types";
import { readWorksheet } from "./xlsx";

// Empty/early-exit parse result: no analysable rows. Keeps the single-file
// shape exactly: no `source` tag, no `sources[]` array.
function emptyResult(name: string, errors: ParseError[], totalRows = 0): ParseResult {
  return {
    file: { name },
    transactions: [],
    totalRows,
    parsedRows: 0,
    skippedRows: 0,
    errors,
    warnings: [],
    columns: {},
    columnDiagnostics: { detected: {}, missing: [], ambiguous: [] },
    currency: null,
  };
}

function normalizeRows(
  header: string[],
  rows: string[][],
  fileName: string,
  sourceLabel?: string,
): ParseResult {
  const cols = detectColumns(header);
  const headerIndex = buildHeaderIndex(cols.detected, header);

  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const transactions: NormalizedTransaction[] = [];
  let parsedRows = 0;
  let skippedRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const sourceRow = i + 1;
    const result = normalizeRow(rows[i], cols.detected, headerIndex, sourceRow);
    if (result.kind === "transaction") {
      const txn = sourceLabel ? { ...result.txn, source: sourceLabel } : result.txn;
      transactions.push(txn);
      parsedRows++;
      if (result.warnings) warnings.push(...result.warnings);
    } else if (result.kind === "skipped") {
      skippedRows++;
    } else {
      errors.push(result.error);
    }
  }

  // Statement currency: only when every parsed row with evidence agrees on one.
  // Mixed or silent files are honestly "unknown" rather than guessed.
  const currencies = new Set<string>();
  for (const t of transactions) {
    if (t.currency) currencies.add(t.currency);
  }
  const currency = currencies.size === 1 ? [...currencies][0] : null;

  return {
    file: { name: fileName },
    transactions,
    totalRows: rows.length,
    parsedRows,
    skippedRows,
    errors,
    warnings,
    columns: cols.detected,
    columnDiagnostics: cols,
    currency,
    sources: sourceLabel
      ? [{ label: sourceLabel, transactionCount: transactions.length, parsedRows, skippedRows }]
      : undefined,
  };
}

export async function parseFile(file: File): Promise<ParseResult> {
  return parseFileInternal(file, undefined);
}

// Step 28 — multi-source parse. Accepts a list of (file, optional label)
// entries, parses each, and returns one merged ParseResult. The transactions
// carry a per-source `source` tag (the label, or the file name when no label
// is given). `sources[]` on the result holds the per-file breakdown so the
// preview can show a "X% of your software spend from {filename}" stat.
//
// Honesty rules (named):
//   - Cross-source deduplication: two transactions with the same
//     (date, amount, normalized description) are kept as separate rows;
//     cross-source dedup is NOT performed. The user uploaded them
//     separately and may legitimately have two accounts both paying for
//     the same tool. A future "they're the same charge" claim requires
//     identity-uncertainty evidence the saved-report layer does not
//     have, so we never invent that link.
//   - Column diagnostics and errors are concatenated across files. A
//     column missing in source B but present in source A is reported as
//     missing.
//   - Currency must agree across sources. A mixed-currency multi-file
//     parse returns `currency === null` (unknown); the comparison
//     engine already labels cross-currency deltas as "not conversion-
//     adjusted".
export async function parseFiles(
  entries: ReadonlyArray<{ file: File; label?: string }>,
): Promise<ParseResult> {
  if (entries.length === 0) {
    throw new Error("parseFiles: at least one file is required.");
  }
  const results: ParseResult[] = [];
  for (const e of entries) {
    const r = await parseFileInternal(e.file, e.label ?? e.file.name);
    results.push(r);
  }
  return mergeResults(results, entries);
}

async function parseFileInternal(
  file: File,
  sourceLabel: string | undefined,
): Promise<ParseResult> {
  resetIdCounter();
  const ext = file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";

  let header: string[];
  let rows: string[][];

  if (ext === "xlsx") {
    const buffer = await file.arrayBuffer();
    let worksheet: { header: string[]; rows: string[][] };
    try {
      worksheet = await readWorksheet(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The workbook could not be read.";
      if (message.includes("EMPTY_FILE")) {
        // Empty workbook: resolve as a controlled, structured result so the
        // caller never sees an unhandled rejection for a user-picked file.
        return emptyResult(file.name, [{ code: "EMPTY_FILE", message: "The workbook is empty; there is no data to analyze." }]);
      }
      // Decompression-bomb and corrupt-workbook hazards keep the established
      // contract (rejection with a typed code), per STEP 36.
      throw err;
    }
    header = worksheet.header;
    rows = worksheet.rows;
  } else {
    // Assumption: UTF-8 encoded CSV text. Not all CSVs are UTF-8; full encoding
    // detection is out of scope for V1. Non-UTF-8 files may misread characters.
    const text = await file.text();
    const { rows: allRows, unterminatedQuote } = parseCsvWithMeta(text);
    if (unterminatedQuote) {
      return emptyResult(file.name, [{ code: "UNSUPPORTED_STRUCTURE", message: "The CSV contains an unterminated quoted field (missing a closing quote)." }]);
    }
    if (allRows.length === 0) {
      return emptyResult(file.name, [{ code: "EMPTY_FILE", message: "The file is empty." }]);
    }
    header = allRows[0];
    rows = allRows.slice(1);
  }

  if (header.length === 0 || header.every((h) => h.trim() === "")) {
    return emptyResult(file.name, [{ code: "MISSING_AMOUNT_COLUMN", message: "No usable header row found." }], rows.length);
  }

  return normalizeRows(header, rows, file.name, sourceLabel);
}

function mergeResults(
  results: ParseResult[],
  entries: ReadonlyArray<{ file: File; label?: string }>,
): ParseResult {
  const sources: NonNullable<ParseResult["sources"]> = [];
  const transactions: NormalizedTransaction[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  let totalRows = 0;
  let parsedRows = 0;
  let skippedRows = 0;

  const allColumns: ColumnMap[] = [];
  const allMissing: string[] = [];
  const allAmbiguous: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const entry = entries[i];
    const label = entry.label ?? entry.file.name;
    sources.push({
      label,
      transactionCount: r.transactions.length,
      parsedRows: r.parsedRows,
      skippedRows: r.skippedRows,
    });
    for (const t of r.transactions) {
      // The internal parse already stamped `source` to the chosen label.
      transactions.push(t);
    }
    totalRows += r.totalRows;
    parsedRows += r.parsedRows;
    skippedRows += r.skippedRows;
    for (const e of r.errors) errors.push(e);
    for (const w of r.warnings) warnings.push(w);
    if (r.columns) allColumns.push(r.columns);
    for (const m of r.columnDiagnostics.missing) if (!allMissing.includes(m)) allMissing.push(m);
    for (const a of r.columnDiagnostics.ambiguous) if (!allAmbiguous.includes(a)) allAmbiguous.push(a);
  }

  // Currency: only when EVERY source agreed on the same one. Mixed or
  // silent files honestly read as null.
  const currencies = new Set<string>();
  for (const r of results) {
    if (r.currency) currencies.add(r.currency);
  }
  const currency = currencies.size === 1 ? [...currencies][0] : null;

  // Column diagnostics for the merged result: the FIRST file's detected
  // columns are reported. (The engine uses these to pick a header when
  // building a per-merchant row view; the per-file result is a fine
  // approximation for V1 because the parse step ran detection per file.)
  const primaryColumns = allColumns[0] ?? {};
  const primaryDiagnostics = results[0]?.columnDiagnostics ?? { detected: primaryColumns, missing: [], ambiguous: [] };

  // Primary file name for display: the first entry's file (or label if
  // provided). Kept for back-compat with the single-file consumers that
  // show `result.file.name` in the header.
  const primary = entries[0];
  const primaryName = primary.label ?? primary.file.name;

  return {
    file: { name: primaryName },
    transactions,
    totalRows,
    parsedRows,
    skippedRows,
    errors,
    warnings,
    columns: primaryColumns,
    columnDiagnostics: {
      detected: primaryDiagnostics.detected,
      missing: allMissing,
      ambiguous: allAmbiguous,
    },
    currency,
    sources,
  };
}
