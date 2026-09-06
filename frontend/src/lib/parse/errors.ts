import type { ParseError } from "./types";

export type ParseErrorSummary = {
  code: ParseError["code"] | string;
  count: number;
  label: string;
  hint: string;
  sampleRows: number[];
};

// Aggregated, human-facing breakdown of parse errors. Raw messages are never
// surfaced: they can embed row content ("Could not read amount \"coffee\"."),
// so the summary is built from code + row number alone.
const CODES: Record<string, { label: string; hint: string }> = {
  MISSING_DATE_COLUMN: {
    label: "No date column detected",
    hint: "Add a column named date, posted date, or transaction date.",
  },
  MISSING_AMOUNT_COLUMN: {
    label: "No amount column detected",
    hint: "Add a column named amount, transaction, or amount ($).",
  },
  INVALID_DATE: {
    label: "Unreadable dates",
    hint: "Use YYYY-MM-DD or MM/DD/YYYY.",
  },
  INVALID_AMOUNT: {
    label: "Unreadable amounts",
    hint: "Use a plain number like 12.99 (no currency symbol needed).",
  },
  INVALID_ROW: {
    label: "Rows skipped",
    hint: "These rows could not be interpreted.",
  },
  UNSUPPORTED_STRUCTURE: {
    label: "Unsupported file structure",
    hint: "Re-export the file as plain CSV.",
  },
  EMPTY_FILE: {
    label: "File is empty",
    hint: "Choose a file that contains rows.",
  },
};

const SAMPLE_LIMIT = 5;

// One entry per error code, sorted by count (then code) for stable output.
export function summarizeParseErrors(errors: ParseError[]): ParseErrorSummary[] {
  const byCode = new Map<string, { count: number; rows: number[] }>();
  for (const e of errors) {
    const entry = byCode.get(e.code) ?? { count: 0, rows: [] };
    entry.count += 1;
    if (e.row !== undefined && !entry.rows.includes(e.row)) {
      if (entry.rows.length < SAMPLE_LIMIT) entry.rows.push(e.row);
    }
    byCode.set(e.code, entry);
  }

  return [...byCode.entries()]
    .map(([code, entry]) => {
      const meta = CODES[code as keyof typeof CODES] ?? { label: code, hint: "Review the source file." };
      return {
        code,
        count: entry.count,
        label: meta.label,
        hint: meta.hint,
        sampleRows: entry.rows.sort((a, b) => a - b),
      };
    })
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}