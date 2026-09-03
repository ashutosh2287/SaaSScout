// Step 10 thresholds. All names are deliberate and documented; none of these
// claim that a given amount is universally "expensive" or that a customer is
// wasting money. They only order spend for prioritization.

// Minimum score at which a candidate is surfaced for review / strong review.
export const REVIEW_SCORE_THRESHOLD = 4;
export const STRONG_REVIEW_SCORE_THRESHOLD = 7;

// Score contributions per axis. These are the ONLY places scores are added, so
// the model stays deterministic and never double-counts a single underlying
// observation across axes.
export const CLASSIFY_HIGH_PTS = 2;
export const CLASSIFY_MEDIUM_PTS = 1;
export const CLASSIFY_LOW_PTS = 0;

// Recurring-pattern evidence axis (Step 16). One axis, bounded, deterministic.
// It consumes Step 15 observations (amountProfile, gapCount, intervalConsistency)
// that Step 15 already computed — Step 16 never recomputes them.
// A software merchant with a concrete recurring schedule starts at a base
// contribution; the amount being highly stable adds support; payment gaps and a
// poorly consistent interval reduce it. These all describe the SAME underlying
// evidence (recurring behaviour), so they are folded into one axis rather than
// double-counted with the separate history/persistence axis.
export const RECUR_SIGNAL_BASE = 2;
export const RECUR_HIGHLY_STABLE_BONUS = 1;
export const RECUR_GAP_PENALTY = -1;
export const RECUR_LOW_CONSISTENCY_PENALTY = -1;

// Recurring evidence that is weak or that varies in amount cannot support a
// "high" review confidence even when the score otherwise suggests it.
export const CONFIDENCE_WEAK_STRENGTHS = ["weak", "insufficient"] as const;
export const CONFIDENCE_VARIABLE_AMOUNT = "variable" as const;

// History long-running axis: contribution by number of payments. Mirrors the
// product guidance (2 = weak, 3-5 = moderate, 6-11 = stronger, 12+ = strong).
export const LONG_RUNNING_STRONG = 12;
export const LONG_RUNNING_STRONGER = 6;
export const LONG_RUNNING_MODERATE = 3;
export const LONG_RUNNING_PTS = { weak: 0, moderate: 1, stronger: 2, strong: 3 } as const;

// A candidate cannot be "strong review" from a flicker of history. Even a small
// dataset needs enough evidence; otherwise review is capped below strong.
export const MIN_PAYMENTS_FOR_STRONG = 6;

// A single payment (even one mislabelled as recurring) is not a review
// candidate — there is simply not enough to review.
export const MIN_PAYMENTS_FOR_REVIEW = 2;

// Spend magnitude axis (supporting evidence only; never gates status on its own).
// Currency-agnostic absolute tiers used only to order spend prioritization.
// A low spend does NOT make a merchant harmless — it simply contributes fewer
// prioritization points while the recurring/history axes still decide status.
export const HIGH_MONTHLY_SPEND = 5000;
export const MODERATE_MONTHLY_SPEND = 1500;
export const HIGH_MONTHLY_PTS = 2;
export const MODERATE_MONTHLY_PTS = 1;
export const LOW_MONTHLY_PTS = 0;

// Confidence: derived from score, capped by classification confidence and by
// data quality when it is not "ready".
export const CONF_HIGH_SCORE = STRONG_REVIEW_SCORE_THRESHOLD;
export const CONF_MEDIUM_SCORE = REVIEW_SCORE_THRESHOLD;

export const DAYS_PER_MONTH = 30;
