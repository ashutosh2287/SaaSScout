import { medianAmount, isAmountStable, amountStability, detectPriceChange } from "./amounts";
import {
  ANNUAL_HIGH_MIN_PAYMENTS,
  LIKELY_MIN_PAYMENTS,
  MIN_PAYMENTS,
  MISSING_PAYMENT_MAX_MULTIPLE,
  MISSING_PAYMENT_MIN_MULTIPLE,
  STRONG_MIN_PAYMENTS,
  STRONG_MIN_SPAN_MONTHS,
  WEEKLY_CONFIDENCE,
} from "./constants";
import { dominantInterval, type DominantInterval } from "./intervals";
import type {
  RecurringAmountStability,
  RecurringConfidence,
  RecurringEvidence,
  RecurringPattern,
  RecurringInterval,
  RecurringPriceChange,
  RecurringResult,
  RecurringStatus,
  RecurringStrength,
  RecurringSummary,
} from "./types";
import type { NormalizedTransactionWithMerchant } from "../merchant/types";

const EMPTY_SUMMARY: RecurringSummary = {
  likelyRecurringCount: 0,
  possiblyRecurringCount: 0,
  notRecurringCount: 0,
  insufficientDataCount: 0,
  totalAnalyzed: 0,
};

// Base period (days) used to recognise a skipped payment for each concrete
// interval. Centres of the interval windows in constants.ts.
const BASE_DAYS: Partial<Record<Exclude<RecurringInterval, null | "irregular">, number>> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  annual: 365,
};

// Recurring detection operates per normalized merchant. Only real merchant
// identities (normalizedKey != null) are analyzed; unresolved transactions are
// skipped because they don't belong to a confirmed merchant.
export function detectRecurring(
  transactions: NormalizedTransactionWithMerchant[],
): RecurringResult {
  const groups = new Map<string, NormalizedTransactionWithMerchant[]>();
  for (const t of transactions) {
    if (t.merchant.normalizedKey === null) continue;
    const list = groups.get(t.merchant.normalizedKey);
    if (list) list.push(t);
    else groups.set(t.merchant.normalizedKey, [t]);
  }

  const patterns = new Map<string, RecurringPattern>();
  const summary: RecurringSummary = { ...EMPTY_SUMMARY };

  for (const [key, txns] of groups) {
    const pattern = analyzeMerchant(txns);
    patterns.set(key, pattern);
    summary.totalAnalyzed += 1;
    switch (pattern.status) {
      case "likely_recurring":
        summary.likelyRecurringCount += 1;
        break;
      case "possibly_recurring":
        summary.possiblyRecurringCount += 1;
        break;
      case "not_recurring":
        summary.notRecurringCount += 1;
        break;
      case "insufficient_data":
        summary.insufficientDataCount += 1;
        break;
    }
  }

  return { patterns, summary };
}

export function analyzeMerchant(
  transactions: NormalizedTransactionWithMerchant[],
): RecurringPattern {
  // Recurring payments are money going out (negative amounts). Positive amounts
  // are credits/refunds/reversals and zero amounts are non-payments — both must
  // not count as another subscription payment (Step 4 sign semantics).
  const payments = transactions
    .filter((t) => t.amount < 0 && t.date !== null)
    .map((t) => ({ date: t.date as string, amount: Math.abs(t.amount) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const deduped = dedupeExact(payments);
  const count = deduped.length;

  const firstSeen = count > 0 ? deduped[0].date : null;
  const lastSeen = count > 0 ? deduped[deduped.length - 1].date : null;
  const typicalAmount = count > 0 ? medianAmount(deduped.map((p) => p.amount)) : null;
  const amounts = deduped.map((p) => p.amount);
  // Shared by every branch below; only status/confidence/interval/evidence vary.
  const base = { transactionCount: count, firstSeen, lastSeen, typicalAmount };

  // ---- Step 15 additive intelligence ----
  const gaps = dayGaps(deduped.map((p) => p.date));
  const dom = dominantInterval(gaps);
  const stable = isAmountStable(amounts);
  const amountProfile = amountStability(amounts);
  const priceChange = detectPriceChange(amounts);
  const gapCount = missingPayments(gaps, dom.interval);
  const spanMonths = monthSpan(firstSeen, lastSeen);

  // Additive fields attached to every returned pattern. Strength is resolved
  // per branch because it depends on the final status.
  const meta = {
    amountProfile,
    priceChange,
    intervalConsistency: dom.consistency,
    patternSpanMonths: spanMonths,
    gapCount,
  };

  const strengthArgs = { count, gapCount, spanMonths, amountProfile, intervalConsistency: dom.consistency };

  if (count < MIN_PAYMENTS) {
    return {
      status: "insufficient_data",
      confidence: "low",
      interval: null,
      evidence: [insufficientHistoryEvidence(count)],
      ...base,
      ...meta,
      strength: computeStrength({ ...strengthArgs, status: "insufficient_data" }),
    };
  }

  if (count === 2) {
    if (dom.interval === "irregular") {
      return {
        status: "not_recurring",
        confidence: "medium",
        interval: null,
        evidence: [irregularEvidence()],
        ...base,
        ...meta,
        strength: computeStrength({ ...strengthArgs, status: "not_recurring" }),
      };
    }
    const evidence = buildEvidence({
      status: "possibly_recurring",
      interval: dom.interval,
      count,
      stable,
      dom,
      typicalAmount,
      spanMonths,
      gapCount,
      priceChange,
    });
    return {
      status: "possibly_recurring",
      confidence: "low",
      interval: dom.interval,
      evidence,
      ...base,
      ...meta,
      strength: computeStrength({ ...strengthArgs, status: "possibly_recurring" }),
    };
  }

  return decideFull({ dom, count, stable, base, spanMonths, gapCount, priceChange, meta, strengthArgs });
}

// A full pattern (>= 3 payments). Interval consistency plus amount stability drive
// status and confidence; see decideConfidence for the confidence rules.
function decideFull(args: {
  dom: DominantInterval;
  count: number;
  stable: boolean;
  base: { transactionCount: number; firstSeen: string | null; lastSeen: string | null; typicalAmount: number | null };
  spanMonths: number;
  gapCount: number;
  priceChange: RecurringPriceChange | null;
  meta: {
    amountProfile: RecurringAmountStability;
    priceChange: RecurringPriceChange | null;
    intervalConsistency: number;
    patternSpanMonths: number;
    gapCount: number;
  };
  strengthArgs: {
    count: number;
    gapCount: number;
    spanMonths: number;
    amountProfile: RecurringAmountStability;
    intervalConsistency: number;
  };
}): RecurringPattern {
  const { dom, count, stable, base, spanMonths, gapCount, priceChange, meta } = args;
  const { typicalAmount } = base;

  if (dom.interval === "irregular") {
    return {
      status: "not_recurring",
      confidence: "medium",
      interval: "irregular",
      evidence: [irregularEvidence()],
      ...base,
      ...meta,
      strength: computeStrength({ ...args.strengthArgs, status: "not_recurring" }),
    };
  }

  const evidence = buildEvidence({
    status: stable ? "likely_recurring" : "possibly_recurring",
    interval: dom.interval,
    count,
    stable,
    dom,
    typicalAmount,
    spanMonths,
    gapCount,
    priceChange,
  });

  if (stable) {
    return {
      status: "likely_recurring",
      confidence: decideConfidence(dom.interval, count),
      interval: dom.interval,
      evidence,
      ...base,
      ...meta,
      strength: computeStrength({ ...args.strengthArgs, status: "likely_recurring" }),
    };
  }

  return {
    status: "possibly_recurring",
    confidence: "medium",
    interval: dom.interval,
    evidence,
    ...base,
    ...meta,
    strength: computeStrength({ ...args.strengthArgs, status: "possibly_recurring" }),
  };
}

function decideConfidence(interval: RecurringInterval, count: number): RecurringConfidence {
  if (interval === "weekly") return WEEKLY_CONFIDENCE;
  if (interval === "annual" && count < ANNUAL_HIGH_MIN_PAYMENTS) return "medium";
  if (count >= LIKELY_MIN_PAYMENTS) return "high";
  return "medium";
}

// Deterministic, evidence-based strength. Deliberately conservative: a small
// dataset or an interrupted/unstable pattern can never read as "strong".
// ponytail: a simple rule table rather than a weighted score; add weights only
// if a real dataset shows it mis-ranks.
function computeStrength(r: {
  status: RecurringStatus;
  count: number;
  gapCount: number;
  spanMonths: number;
  amountProfile: RecurringAmountStability;
  intervalConsistency: number;
}): RecurringStrength {
  if (r.status === "insufficient_data") return "insufficient";
  if (r.status === "not_recurring") return "weak";
  if (r.gapCount > 0) return "moderate";
  if (r.count < 3) return "weak";
  if (r.amountProfile === "variable") return "weak";
  if (r.intervalConsistency < 0.7) return "moderate";
  if (r.count >= STRONG_MIN_PAYMENTS) return "strong";
  if (r.count >= 4 && r.spanMonths >= STRONG_MIN_SPAN_MONTHS) return "strong";
  return "moderate";
}

// Count interval-sized holes as potentially missing payments. Only meaningful
// for a concrete interval; irregular patterns already signal inconsistency.
function missingPayments(gaps: number[], interval: RecurringInterval): number {
  const base = interval === null || interval === "irregular" ? undefined : BASE_DAYS[interval];
  if (base === undefined) return 0;
  let missing = 0;
  for (const g of gaps) {
    const ratio = g / base;
    if (ratio >= MISSING_PAYMENT_MIN_MULTIPLE && ratio <= MISSING_PAYMENT_MAX_MULTIPLE) missing += 1;
    else if (ratio > MISSING_PAYMENT_MAX_MULTIPLE) missing += 1;
  }
  return missing;
}

// Approximate whole months between two ISO dates, for history-length messaging.
function monthSpan(first: string | null, last: string | null): number {
  if (!first || !last) return 0;
  const a = Date.parse(first);
  const b = Date.parse(last);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / (30.44 * 86400000));
}

function buildEvidence(args: {
  status: RecurringStatus;
  interval: RecurringInterval;
  count: number;
  stable: boolean;
  dom: DominantInterval;
  typicalAmount: number | null;
  spanMonths: number;
  gapCount: number;
  priceChange: RecurringPriceChange | null;
}): RecurringEvidence[] {
  const { count, interval, typicalAmount, spanMonths, gapCount, priceChange } = args;
  const evidence: RecurringEvidence[] = [];

  if (count > 0 && interval !== "irregular") {
    evidence.push(paymentHistoryEvidence(count, spanMonths));
  }

  if (args.interval && args.interval !== "irregular") {
    const ev = intervalEvidence(args.interval);
    if (ev) evidence.push(ev);
  }

  if (args.stable && typicalAmount !== null) {
    evidence.push({
      type: "stable_amount",
      message: `Amount stays around ${formatAmount(typicalAmount)}.`,
    });
  } else if (args.interval !== "irregular") {
    evidence.push({
      type: "amount_variation",
      message: "Payment amounts vary significantly between occurrences.",
    });
  }

  if (priceChange !== null) {
    evidence.push(priceChangeEvidence(priceChange));
  }

  if (gapCount > 0) {
    evidence.push({
      type: "payment_gap",
      message: "The recurring pattern has a gap; a payment appears to be missing.",
    });
  }

  return evidence;
}

function intervalEvidence(interval: RecurringInterval): RecurringEvidence | null {
  switch (interval) {
    case "weekly":
      return { type: "weekly_pattern", message: "Payments occur approximately weekly." };
    case "monthly":
      return { type: "monthly_pattern", message: "Payments occur approximately every month." };
    case "quarterly":
      return { type: "quarterly_pattern", message: "Payments occur approximately every 3 months." };
    case "annual":
      return { type: "annual_pattern", message: "Payments occur approximately every year." };
    default:
      return null;
  }
}

function paymentHistoryEvidence(count: number, spanMonths: number): RecurringEvidence {
  if (count < 3) {
    return {
      type: "payment_history",
      message: `Only ${count} payment${count === 1 ? "" : "s"} were found, so recurring confidence is limited.`,
    };
  }
  const message =
    spanMonths > 0
      ? `${count} payments were observed over about ${spanMonths} months.`
      : `${count} payments were observed.`;
  return { type: "payment_history", message };
}

function priceChangeEvidence(change: RecurringPriceChange): RecurringEvidence {
  const dir = change.to >= change.from ? "increased" : "decreased";
  return {
    type: "price_change",
    message: `A recurring amount ${dir} from approximately ${formatAmount(change.from)} to ${formatAmount(change.to)}.`,
  };
}

function irregularEvidence(): RecurringEvidence {
  return {
    type: "regular_interval",
    message: "No consistent payment interval was found.",
  };
}

function insufficientHistoryEvidence(count: number): RecurringEvidence {
  return {
    type: "insufficient_history",
    message:
      count === 0
        ? "No payment history to assess."
        : "Not enough payment history to detect a recurring pattern.",
  };
}

function dayGaps(dates: string[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const prev = Date.parse(dates[i - 1]);
    const curr = Date.parse(dates[i]);
    if (Number.isFinite(prev) && Number.isFinite(curr)) {
      gaps.push(Math.round((curr - prev) / 86400000));
    }
  }
  return gaps;
}

// Remove obvious duplicates: a payment with the same date and amount as one
// already kept is almost certainly an accidental repeat, not a second pattern
// point. Conservative; legit same-day same-amount same-merchant spend is rare.
// ponytail: full duplicate detection lives in Step 5; this cheap guard only
// avoids counting obvious repeats twice here.
function dedupeExact(
  payments: { date: string; amount: number }[],
): { date: string; amount: number }[] {
  const seen = new Set<string>();
  const out: { date: string; amount: number }[] = [];
  for (const p of payments) {
    const key = `${p.date}|${p.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

// Currency-neutral display for evidence. Sasscout is currency-agnostic; the
// value is semantic (typical amount), not a currency-specific price.
function formatAmount(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
