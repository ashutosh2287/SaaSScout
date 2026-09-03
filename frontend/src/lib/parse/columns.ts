import type { ColumnDiagnostics, ColumnMap } from "./types";

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

const DATE_NAMES = ["date", "transaction date", "posted date", "posting date", "trans date", "transactiondate"];
const DESCRIPTION_NAMES = [
  "description",
  "merchant",
  "merchant name",
  "payee",
  "memo",
  "details",
  "transaction description",
  "name",
];
const AMOUNT_NAMES = ["amount", "transaction amount", "value", "total", "sum"];
const DEBIT_NAMES = ["debit", "debit amount", "withdrawal"];
const CREDIT_NAMES = ["credit", "credit amount", "deposit"];

function find(normalized: string[], names: string[], used: Set<number>): string | undefined {
  const idx = names
    .map((n) => normalized.indexOf(n))
    .filter((i) => i >= 0 && !used.has(i))
    .sort((a, b) => a - b)[0];
  if (idx === undefined) return undefined;
  used.add(idx);
  return normalized[idx];
}

export function detectColumns(headerRow: string[]): ColumnDiagnostics {
  const normalized = headerRow.map(normalize);
  const used = new Set<number>();

  const date = find(normalized, DATE_NAMES, used);
  const description = find(normalized, DESCRIPTION_NAMES, used);
  const debit = find(normalized, DEBIT_NAMES, used);
  const credit = find(normalized, CREDIT_NAMES, used);
  // Only look for a unified amount column if debit/credit pair did not match.
  const amount = find(normalized, AMOUNT_NAMES, used);

  const detected: ColumnMap = {
    date,
    description,
    amount,
    debit,
    credit,
  };

  const missing: string[] = [];
  if (!date) missing.push("date");
  if (!description) missing.push("description");
  const hasDebitCredit = Boolean(debit || credit);
  if (!amount && !hasDebitCredit) missing.push("amount");

  // Ambiguous: both debit and credit exist without a unified amount, or an
  // amount column exists alongside a debit/credit pair.
  const ambiguous: string[] = [];
  if (amount && hasDebitCredit) ambiguous.push("amount vs debit/credit");
  if (debit && credit && amount) ambiguous.push("debit/credit vs amount");

  return { detected, missing, ambiguous };
}