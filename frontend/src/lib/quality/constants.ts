// Configurable thresholds and heuristics for the data-quality layer.

// A day-gap at or above this count is flagged as a "large date gap" warning.
export const SIGNIFICANT_DATE_GAP_DAYS = 45;

// A dataset whose observed date range is below this many days is flagged as
// short history (insufficient for recurring analysis).
export const MIN_USEFUL_HISTORY_DAYS = 90;

// Below this many transactions the dataset is considered small.
export const SMALL_DATASET_THRESHOLD = 10;

// A description with fewer non-space characters than this is low-information.
export const MIN_DESCRIPTION_LENGTH = 3;

// Quality levels (implementation thresholds, not an industry standard).
export const LEVEL_GOOD = 90;
export const LEVEL_FAIR = 70;

// Fraction (0..1) required for the dataset to be considered "ready" on date
// completeness.
export const MIN_DATE_COMPLETENESS = 0.9;

// Max share of rows that are exact/possible duplicates before we start
// penalizing heavily.
export const MAX_DUPLICATE_RATE = 0.1;