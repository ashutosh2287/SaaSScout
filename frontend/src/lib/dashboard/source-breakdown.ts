import type { NormalizedTransaction } from "../parse/types";
import type { SasscoutReport } from "../report/types";

// Step 28 — cross-source software spend breakdown.
//
// Pure, presentational. Reads the per-source `source` tag on each
// transaction the parser preserves, and the software-merchant verdict
// the aggregate layer already computed. No new data is introduced.
//
// Attribution rule: a negative-amount transaction contributes to a
// source's total when (a) the report classified its raw description as
// a software merchant, and (b) the transaction carries a source label
// the upload was tagged with. A transaction that did not carry a
// source tag (the single-file path) is bucketed as "(unspecified)"
// rather than silently rolled into the first source.
//
// Percentage rounding: whole-percent per entry; the largest entry
// absorbs the drift so the column sums to exactly 100.

export type SourceBreakdownEntry = {
  label: string;
  amount: number;
  sharePercent: number;
};

export type SourceBreakdown = {
  totalIdentifiedSoftwareSpend: number;
  bySource: SourceBreakdownEntry[];
  isMultiSource: boolean;
};

const NO_BREAKDOWN: SourceBreakdown = {
  totalIdentifiedSoftwareSpend: 0,
  bySource: [],
  isMultiSource: false,
};

export function deriveSourceBreakdown(
  report: SasscoutReport,
  transactions: readonly NormalizedTransaction[],
  sourceLabels: readonly string[],
): SourceBreakdown {
  const total = report.softwareSpend.totalSoftwareSpend;
  if (total === null || total <= 0 || sourceLabels.length < 2) {
    return { ...NO_BREAKDOWN, totalIdentifiedSoftwareSpend: total ?? 0 };
  }

  // Set of lowercased raw descriptions the aggregate layer has accepted
  // as software. Exact-case match would fail on real inputs (the engine
  // normalizes descriptions before keying them); the report keeps the
  // original casing, so we normalize on both sides.
  const softwareDescriptions = new Set<string>();
  for (const m of report.merchants) {
    if (m.softwareStatus !== "software") continue;
    for (const d of m.distinctRawDescriptions) {
      softwareDescriptions.add(d.trim().toLowerCase());
    }
  }
  if (softwareDescriptions.size === 0) {
    return { ...NO_BREAKDOWN, totalIdentifiedSoftwareSpend: total };
  }

  const byAmount = new Map<string, number>();
  for (const label of sourceLabels) byAmount.set(label, 0);
  let unspecified = 0;
  let anyMatched = false;

  for (const t of transactions) {
    if (t.amount >= 0) continue; // refund / credit
    const key = t.description.trim().toLowerCase();
    if (!softwareDescriptions.has(key)) continue;
    anyMatched = true;
    const abs = Math.abs(t.amount);
    if (t.source && byAmount.has(t.source)) {
      byAmount.set(t.source, (byAmount.get(t.source) ?? 0) + abs);
    } else {
      unspecified += abs;
    }
  }

  if (!anyMatched) {
    return { ...NO_BREAKDOWN, totalIdentifiedSoftwareSpend: total };
  }

  let grand = 0;
  for (const v of byAmount.values()) grand += v;
  grand += unspecified;

  const entries: SourceBreakdownEntry[] = [];
  let usedPercent = 0;
  for (const [label, amount] of byAmount) {
    if (amount === 0) continue;
    const sharePercent = Math.round((amount / grand) * 100);
    usedPercent += sharePercent;
    entries.push({ label, amount, sharePercent });
  }
  if (unspecified > 0) {
    const sharePercent = Math.max(0, Math.round((unspecified / grand) * 100));
    usedPercent += sharePercent;
    entries.push({ label: "(unspecified)", amount: unspecified, sharePercent });
  }

  // Absorb rounding drift into the largest entry so the column sums to 100.
  const drift = 100 - usedPercent;
  if (drift !== 0 && entries.length > 0) {
    const largest = entries.reduce((a, b) => (b.amount > a.amount ? b : a));
    largest.sharePercent = Math.max(0, Math.min(100, largest.sharePercent + drift));
  }

  entries.sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
  return { totalIdentifiedSoftwareSpend: total, bySource: entries, isMultiSource: true };
}
