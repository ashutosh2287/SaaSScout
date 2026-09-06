import type { RecurringPattern, RecurringInterval } from "../recurring/types";
import type { SoftwareSpendMerchant } from "../software/types";
import { isCurrencySymbol } from "../parse/currency";
import type { ReviewReason } from "./types";
import { DAYS_PER_MONTH } from "./constants";

function fmtMoney(n: number | null, currency?: string | null): string | null {
  if (n === null) return null;
  const symbol = isCurrencySymbol(currency) ? currency : "$";
  return symbol + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// Approximate months between two ISO dates, floored at zero. Retained as a
// small utility (used by tests); review reasons prefer Step 15's
// patternSpanMonths which the recurring layer already computed.
export function monthsBetween(first: string | null, last: string | null): number {
  if (!first || !last) return 0;
  const a = Date.parse(first);
  const b = Date.parse(last);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.floor((b - a) / (DAYS_PER_MONTH * 86400000));
}

function intervalPhrase(interval: RecurringInterval): string | null {
  switch (interval) {
    case "weekly":
      return "weekly";
    case "monthly":
      return "monthly";
    case "quarterly":
      return "quarterly";
    case "annual":
      return "annually";
    default:
      return null;
  }
}

// User-facing review reasons built from Step 15 recurring evidence. Each reason
// adds distinct information; the same observation is never repeated in two
// reasons. No internal scoring terms are exposed. Step 15 is the only source of
// truth for amount stability, gaps, price changes and span — nothing here
// recomputes them.
export function buildReasons(m: SoftwareSpendMerchant, currency?: string | null): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  const r = m.recurring;
  const paymentCount = m.transactionCount;
  const recurringSignal = isRecurringSignal(r);

  if (recurringSignal) {
    reasons.push({ type: "recurring_software", message: "Recurring software payment detected." });
  }

  // Interval pattern (only when a concrete interval exists and the schedule is
  // coherent enough that the recurring layer recognised it).
  if (recurringSignal && r) {
    const phrase = intervalPhrase(r.interval);
    if (phrase) {
      reasons.push({
        type: "interval_pattern",
        message: `Payments occur approximately ${phrase}.`,
      });
    }
  }

  // Persistence evidenced by the recurring layer's own span (not recomputed here).
  if (r && r.patternSpanMonths >= 6) {
    reasons.push({
      type: "long_running",
      message: `Pattern spans approximately ${r.patternSpanMonths} months.`,
    });
  }

  const monthly = m.estimatedMonthlySpend;
  const yearly = m.estimatedYearlySpend;
  const mStr = fmtMoney(monthly, currency);
  const yStr = fmtMoney(yearly, currency);
  if (monthly !== null && mStr !== null) {
    reasons.push({ type: "high_monthly_spend", message: `Estimated recurring spend of ${mStr}/month.` });
  } else if (yearly !== null && yStr !== null) {
    reasons.push({ type: "high_yearly_spend", message: `Estimated recurring spend of ${yStr}/year.` });
  }

  if (paymentCount >= 3) {
    reasons.push({ type: "many_occurrences", message: `${paymentCount} payments were observed.` });
  }

  // Amount stability evidence from Step 15's amountProfile. A highly stable
  // amount strengthens the pattern; variable amounts are surfaced (carefully)
  // as reduced certainty, not as proof of a problem.
  if (r && r.amountProfile === "highly_stable") {
    reasons.push({
      type: "stable_recurring_charge",
      message: "Recurring amounts are highly stable.",
    });
  } else if (r && r.amountProfile === "variable") {
    reasons.push({
      type: "amount_stability",
      message: "Recurring amounts vary between payments.",
    });
  }

  // A price change is supporting evidence, never proof of unfairness.
  if (r && r.priceChange) {
    const from = fmtMoney(r.priceChange.from, currency);
    const to = fmtMoney(r.priceChange.to, currency);
    if (from !== null && to !== null) {
      const direction = r.priceChange.to > r.priceChange.from ? "increased" : "decreased";
      reasons.push({
        type: "price_change",
        message: `Recurring amount ${direction} from about ${from} to ${to}.`,
      });
    }
  }

  // A payment gap weakens certainty; it says nothing about cancellation.
  if (r && r.gapCount > 0) {
    reasons.push({ type: "payment_gap", message: "Recurring pattern has a payment gap." });
  }

  // Limited payment history is surfaced only as a reason (the status caps are
  // enforced separately); it never claims the subscription is unused.
  if (recurringSignal && paymentCount >= 3 && paymentCount <= 4) {
    reasons.push({
      type: "limited_payments",
      message: `Recurring evidence is limited because only ${paymentCount} payments were observed.`,
    });
  }

  return reasons;
}

export function isConcreteInterval(interval: RecurringInterval | undefined): boolean {
  return (
    interval === "weekly" ||
    interval === "monthly" ||
    interval === "quarterly" ||
    interval === "annual"
  );
}

// Single source of truth for "this pattern is a real recurring candidate".
export function isRecurringSignal(r: RecurringPattern | null): r is RecurringPattern {
  return (
    r !== null &&
    (r.status === "likely_recurring" || r.status === "possibly_recurring") &&
    isConcreteInterval(r.interval)
  );
}
