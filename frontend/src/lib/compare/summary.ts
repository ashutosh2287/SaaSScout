import type { ComparisonFinding } from "./types";
import { isCurrencySymbol } from "../parse/currency";

// Step 25 — compact comparison summary band.
//
// A pure aggregate over the findings the comparison ALREADY produced: no new
// analytical semantics, no scoring, no thresholds. The model is a single O(n)
// pass; presentation is a separate pure formatter so currency / order honesty
// lives in one testable place.
//
// Honesty rules (not product taste): the net is only presented when comparison
// direction is trustworthy (`ordered !== false`); a multi-currency net is
// explicitly labeled not conversion-adjusted; null / NaN / Infinity deltas never
// corrupt the total; a net of zero is shown as $0.00, never as a signed zero.

export type CompareSummary = {
  findingCount: number;
  /** Sum of valid (finite) annualized deltas; null when none exist. */
  netAnnualizedDelta: number | null;
  increaseCount: number;
  decreaseCount: number;
  newRecurringCount: number;
  endedRecurringCount: number;
};

export function summarizeFindings(findings: readonly ComparisonFinding[]): CompareSummary {
  let net = 0;
  let valid = 0;
  let inc = 0;
  let dec = 0;
  let nw = 0;
  let ed = 0;
  for (const f of findings) {
    const d = f.impact.yearlyDelta;
    if (d !== null && Number.isFinite(d)) {
      net += d;
      valid++;
      if (d > 0) inc++;
      else if (d < 0) dec++;
    }
    if (f.kind === "new_recurring") nw++;
    if (f.kind === "ended_recurring") ed++;
  }
  return {
    findingCount: findings.length,
    netAnnualizedDelta: valid === 0 ? null : net,
    increaseCount: inc,
    decreaseCount: dec,
    newRecurringCount: nw,
    endedRecurringCount: ed,
  };
}

export type SummaryViewOptions = {
  currency?: string | null;
  currencyMismatch?: boolean;
  ordered?: boolean;
};

export function formatSummary(summary: CompareSummary, opts: SummaryViewOptions = {}): string {
  const parts = [`${summary.findingCount} change${summary.findingCount === 1 ? "" : "s"}`];

  if (opts.ordered === false) {
    parts.push("window order unclear — verify the periods selected");
    return parts.join(" · ");
  }

  const symbol = opts.currency && isCurrencySymbol(opts.currency) ? opts.currency : "$";

  if (summary.netAnnualizedDelta !== null) {
    const net = summary.netAnnualizedDelta;
    const body =
      net > 0
        ? `+${symbol}${net.toFixed(2)}`
        : net < 0
          ? `−${symbol}${Math.abs(net).toFixed(2)}`
          : `${symbol}0.00`;
    let seg = `Net ${body}/yr`;
    if (opts.currencyMismatch) seg += " (not conversion-adjusted)";
    parts.push(seg);
  }

  if (summary.increaseCount > 0) parts.push(`${summary.increaseCount} increase${summary.increaseCount === 1 ? "" : "s"}`);
  if (summary.decreaseCount > 0) parts.push(`${summary.decreaseCount} decrease${summary.decreaseCount === 1 ? "" : "s"}`);
  if (summary.newRecurringCount > 0) parts.push(`${summary.newRecurringCount} new`);
  if (summary.endedRecurringCount > 0) parts.push(`${summary.endedRecurringCount} ended`);

  return parts.join(" · ");
}