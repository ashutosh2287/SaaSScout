// Recurring detection thresholds. All named; no magic numbers in logic.

// Minimum payments needed to call something "recurring" at all (a single
// payment can never establish a pattern).
export const MIN_PAYMENTS = 2;

// Payments required before we will claim a stable pattern is "likely".
export const LIKELY_MIN_PAYMENTS = 3;

// Interval-tolerance windows (in days) around each calendrical target.
// Windows are deliberately wider than exact targets so real calendar months
// (28-31 days) and month-end billing (Jan 31 -> Feb 28 -> Mar 31) are still
// recognized as monthly rather than falsely rejected.
export const INTERVAL_WINDOW_WEEKLY = { min: 5, max: 9 }; // ~7 days
export const INTERVAL_WINDOW_MONTHLY = { min: 25, max: 35 }; // ~30 days
export const INTERVAL_WINDOW_QUARTERLY = { min: 84, max: 98 }; // ~91 days
export const INTERVAL_WINDOW_ANNUAL = { min: 350, max: 380 }; // ~365 days

// Fraction of observed gaps that must fit the dominant interval before we trust
// that interval as the pattern.
export const INTERVAL_CONSISTENCY_THRESHOLD = 0.5;

// Relative amount tolerance. 1499/1500/1498 count as stable because tax, FX
// and rounding cause small differences. 5999 inside a set of ~1499 does not.
export const AMOUNT_RELATIVE_TOLERANCE = 0.1;

// Weekly recurrence is inherently ambiguous (transport, groceries, payroll), so
// it never reaches high confidence even with a clean interval.
export const WEEKLY_CONFIDENCE = "medium" as const;
// Annual patterns have few observations; demand more payments before high.
export const ANNUAL_HIGH_MIN_PAYMENTS = 4;

// ---- Step 15: amount stability + strength thresholds ----

// Below this max relative deviation from the median an amount set is considered
// "highly stable" (rounding / FX / small tax jitter only).
export const HIGHLY_STABLE_RELATIVE_TOLERANCE = 0.02;

// A set whose max deviation stays under this bound (and is not a clean price
// change) is "moderately stable"; beyond it the amounts look variable.
export const VARIABLE_MAX_RELATIVE = 0.35;

// A clean old->new amount step of at least this relative size is reported as a
// price change rather than generic amount variation.
export const PRICE_CHANGE_MIN_RELATIVE = 0.15;

// Payments required before pattern strength can be "strong".
export const STRONG_MIN_PAYMENTS = 6;

// History span (whole months) over which even a low-frequency pattern earns
// "strong" (e.g. an annual subscription seen across multiple years).
export const STRONG_MIN_SPAN_MONTHS = 24;

// A gap at least this many times the period is treated as a missing payment.
export const MISSING_PAYMENT_MIN_MULTIPLE = 1.5;
// A single interval gap bigger than this many periods counts as (at least) one
// missing payment rather than a handful of skipped observations.
export const MISSING_PAYMENT_MAX_MULTIPLE = 2.5;
