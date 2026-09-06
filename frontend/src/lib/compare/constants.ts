import { PRICE_CHANGE_MIN_RELATIVE } from "../recurring/constants";
import type { RecurringInterval } from "../recurring/types";

// Phase 18 — period-over-period comparison thresholds. Every threshold is named;
// no magic numbers in the rules. Reuses the recurring layer's material-change
// magnitude (PRICE_CHANGE_MIN_RELATIVE = 0.15) so a cross-period amount step is
// treated with the same severity the engine already treats an intra-period step.

// A price change is "material" only when BOTH of these hold. The relative clause
// matches the engine's own price-change magnitude; the absolute clause stops a
// $0.10 -> $0.115 charge (15%) from being inflated into a finding.
export const MATERIAL_PRICE_MIN_RELATIVE = PRICE_CHANGE_MIN_RELATIVE;
export const MATERIAL_PRICE_MIN_ABS_DOLLARS = 1.0;

// Expected cadence of each concrete interval, in days. Used to decide whether a
// window is long enough that "no transactions for this merchant" is evidence of
// absence rather than absence of evidence.
export const INTERVAL_PERIOD_DAYS: Record<Exclude<RecurringInterval, "irregular" | null>, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  annual: 365,
};

// Cycles of the expected cadence a window must cover before we will claim
// "absent in this period" as evidence the charge ended / never started.
export const ABSENCE_EVIDENCE_MIN_CYCLES = 1;
export const ABSENCE_EVIDENCE_STRONG_CYCLES = 2;

// A weekly interval is genuinely ambiguous (transport, meals, misc); cadence
// claims around it never reach high confidence.
export const WEEKLY_INTERVAL_MAX_CONFIDENCE = "medium" as const;

// When total spend in a period is the only signal (non-recurring merchants),
// presence changes are always informational and never a subscription claim.
export const PRESENCE_CHANGE_CONFIDENCE = "low" as const;

// ---- Step 19: transaction-edge evidence (charge boundaries + cadence gaps) ----

// A live pattern in the current period is called "became irregular" only when
// the surviving aggregate evidence actually proves scatter: at least this many
// charges AND a spread of at least one expected baseline cycle AND no reliable
// dominant interval. Fewer charges cannot separate a broken cadence from a
// cancelled service's final bills — those stay suppressed.
export const IRREGULAR_MIN_CHARGES = 3;

// A baseline pattern whose own cadence was this sloppy cannot support a
// confident "ended": it is as consistent with "was already becoming irregular"
// as with "stopped". Below this consistency the ended claim caps at medium.
export const BASELINE_WEAK_CONSISTENCY_MAX = 0.7;

// Identity-uncertainty guard (Case E). When a software merchant disappears from
// the current period while a DIFFERENT merchant with similar raw descriptions
// appears there, the disappearance may be a descriptor change rather than an
// ended charge. Overlap = Dice similarity between the two description token
// sets. Generic corporate/domain tokens are excluded from the alphabet.
export const DESCRIPTOR_OVERLAP_MIN_DICE = 0.5;

export const GENERIC_DESC_TOKENS = new Set([
  "com",
  "www",
  "net",
  "the",
  "and",
  "of",
  "co",
  "llc",
  "inc",
  "corp",
  "ltd",
  "plc",
  "group",
  "service",
  "services",
  "technology",
  "technologies",
  "software",
  "solutions",
  "platform",
  "cloud",
  "online",
  "store",
]);

// Descriptions that read as the AFTERMATH of a charge (a refund or reversal of
// the earlier period's bill) must never be mistaken for the same subscription
// continuing under a changed descriptor. These markers exclude an appearing
// merchant from identity pairing with a vanished one.
export const REFUND_MARKER_TOKENS = new Set([
  "refund",
  "refunds",
  "refunded",
  "refunding",
  "reversal",
  "reversed",
  "reverse",
  "credit",
  "adjustment",
  "correction",
  "reimburse",
  "reimbursement",
  "return",
]);