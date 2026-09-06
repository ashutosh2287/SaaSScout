import { detectColumns } from "./columns";
import { parseCsvWithMeta } from "./csv";
import { buildHeaderIndex, normalizeRow, resetIdCounter } from "./normalize";
import type { ParseError, ParseResult, ParseWarning } from "./types";
import { readWorksheet } from "./xlsx";

// Empty/early-exit parse result: no analysable rows.
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
  };
}

function normalizeRows(
  header: string[],
  rows: string[][],
  fileName: string,
): ParseResult {
  const cols = detectColumns(header);
  const headerIndex = buildHeaderIndex(cols.detected, header);

  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const transactions = [];
  let parsedRows = 0;
  let skippedRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const sourceRow = i + 1;
    const result = normalizeRow(rows[i], cols.detected, headerIndex, sourceRow);
    if (result.kind === "transaction") {
      transactions.push(result.txn);
      parsedRows++;
      if (result.warnings) warnings.push(...result.warnings);
    } else if (result.kind === "skipped") {
      skippedRows++;
    } else {
      errors.push(result.error);
    }
  }

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
  };
}

export async function parseFile(file: File): Promise<ParseResult> {
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

  return normalizeRows(header, rows, file.name);
}