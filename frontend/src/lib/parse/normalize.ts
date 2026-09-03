import { parseAmount } from "./amounts";
import { parseDate } from "./dates";
import type { ColumnMap, NormalizedTransaction, ParseError, ParseWarning } from "./types";

let idCounter = 0;

export type RowResult =
  | { kind: "transaction"; txn: NormalizedTransaction; warnings?: ParseWarning[] }
  | { kind: "skipped"; reason: "blank" | "total" }
  | { kind: "error"; error: ParseError };

const TOTAL_RE =
  /^\s*(total|sub\s*total|balance|grand\s*total|closing\s*balance|ending\s*balance)\b/i;

function stripRow(row: string[]): string {
  return row
    .map((c) => (typeof c === "string" ? c : String(c ?? "")))
    .filter((c) => c.trim() !== "")
    .join(" ");
}

export function normalizeRow(
  row: string[],
  cols: ColumnMap,
  headerIndex: Record<string, number>,
  sourceRow: number,
): RowResult {
  const joined = stripRow(row);
  if (joined.trim() === "") return { kind: "skipped", reason: "blank" };
  if (TOTAL_RE.test(joined)) return { kind: "skipped", reason: "total" };

  const description = pick(row, cols.description, headerIndex);
  const dateRaw = pick(row, cols.date, headerIndex);

  let amount: number | null = null;
  let amountError: ParseError | null = null;

  // Unified amount
  if (cols.amount !== undefined) {
    const r = pick(row, cols.amount, headerIndex);
    const res = parseAmount(r);
    if (res.ok) {
      amount = res.value;
    } else if (res.reason === "not-a-number") {
      amountError = { row: sourceRow, field: cols.amount, code: "INVALID_AMOUNT", message: `Could not read amount "${r}".` };
    }
  } else if (cols.debit !== undefined || cols.credit !== undefined) {
    // Debit/credit pair: debit negative, credit positive.
    const debit = cols.debit !== undefined ? pick(row, cols.debit, headerIndex) : "";
    const credit = cols.credit !== undefined ? pick(row, cols.credit, headerIndex) : "";
    const dRes = parseAmount(debit);
    const cRes = parseAmount(credit);
    if (dRes.ok && dRes.value !== 0 && cRes.ok && cRes.value !== 0) {
      amountError = { row: sourceRow, field: "debit/credit", code: "INVALID_AMOUNT", message: `Both debit and credit present in row ${sourceRow}.` };
    } else if (dRes.ok && dRes.value !== 0) {
      amount = -dRes.value;
    } else if (cRes.ok && cRes.value !== 0) {
      amount = cRes.value;
    } else if (!dRes.ok && dRes.reason === "not-a-number") {
      amountError = { row: sourceRow, field: "debit", code: "INVALID_AMOUNT", message: `Could not read debit "${debit}".` };
    } else if (!cRes.ok && cRes.reason === "not-a-number") {
      amountError = { row: sourceRow, field: "credit", code: "INVALID_AMOUNT", message: `Could not read credit "${credit}".` };
    }
  }

  if (amountError) {
    return { kind: "error", error: amountError };
  }
  if (amount === null) {
    return {
      kind: "error",
      error: { row: sourceRow, field: cols.amount ?? "debit/credit", code: "INVALID_AMOUNT", message: "No amount present in row." },
    };
  }

  let date: string | null = null;
  const warnings: ParseWarning[] = [];
  const dateDecode = parseDate(dateRaw);
  if (dateDecode.ok) {
    date = dateDecode.value;
    if (dateDecode.ambiguous) {
      warnings.push({
        row: sourceRow,
        code: "AMBIGUOUS_DATE",
        message: `Date "${dateRaw}" is ambiguous; interpreted as ${date} (US month/day).`,
      });
    }
  } else if (dateDecode.reason === "invalid") {
    return {
      kind: "error",
      error: { row: sourceRow, field: cols.date, code: "INVALID_DATE", message: `Could not read date "${dateRaw}".` },
    };
  }

  return {
    kind: "transaction",
    txn: {
      id: `t${++idCounter}`,
      date,
      description: description === "" ? "(no description)" : description,
      amount,
      sourceRow,
    },
    warnings,
  };
}

function pick(row: string[], colName: string | undefined, headerIndex: Record<string, number>): string {
  if (colName === undefined) return "";
  const idx = headerIndex[colName];
  if (idx === undefined) return "";
  return typeof row[idx] === "string" ? row[idx] : String(row[idx] ?? "");
}

export function buildHeaderIndex(cols: ColumnMap, headerRow: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  const norm = headerRow.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " "));
  const names = new Set(
    [cols.date, cols.description, cols.amount, cols.debit, cols.credit].filter(Boolean) as string[],
  );
  norm.forEach((n, i) => {
    if (n !== "" && names.has(n)) index[n] = i;
  });
  return index;
}

export function resetIdCounter() {
  idCounter = 0;
}