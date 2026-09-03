// Limits used to keep summaries small and predictable.
export const TOP_SOFTWARE_BY_TOTAL = 8;
export const TOP_RECURRING_BY_MONTHLY = 8;

// Divisor/multiplier used to convert a recurring interval's typical amount into
// a monthly and yearly estimate. Conservative by construction — annual and
// quarterly figures have few observations, so they are marked as estimates.
export const MONTHS_PER_YEAR = 12;
export const MONTHS_PER_QUARTER = 3;
export const WEEKS_PER_YEAR = 52;
