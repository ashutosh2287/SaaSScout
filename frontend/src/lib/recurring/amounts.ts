import {
  AMOUNT_RELATIVE_TOLERANCE,
  HIGHLY_STABLE_RELATIVE_TOLERANCE,
  PRICE_CHANGE_MIN_RELATIVE,
  VARIABLE_MAX_RELATIVE,
} from "./constants";
import type { RecurringAmountStability, RecurringPriceChange } from "./types";

// Median of positive amounts (payments). Robust against a single large outlier,
// e.g. [1499, 1499, 1499, 5999] -> 1499.
export function medianAmount(amounts: number[]): number | null {
  if (amounts.length === 0) return null;
  const sorted = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// True when every amount is within the relative tolerance of the median.
export function isAmountStable(amounts: number[]): boolean {
  if (amounts.length === 0) return true;
  const median = medianAmount(amounts);
  if (median === null || median === 0) return false;
  return amounts.every((a) => {
    const deviation = Math.abs(a - median);
    return deviation / Math.abs(median) <= AMOUNT_RELATIVE_TOLERANCE;
  });
}

// ---- Step 15: granular amount behaviour ----

function maxRelativeDeviation(amounts: number[], median: number): number {
  let max = 0;
  for (const a of amounts) {
    const dev = Math.abs(a - median) / Math.abs(median);
    if (dev > max) max = dev;
  }
  return max;
}

// Classify how stable a payment amount set is:
//   highly_stable        -> only rounding/FX jitter around one value
//   moderately_stable    -> a clean price step, or mild variation under a band
//   variable             -> amounts scatter far from any coherent level
//   insufficient_evidence -> fewer than 2 payments to judge
export function amountStability(amounts: number[]): RecurringAmountStability {
  if (amounts.length < 2) return "insufficient_evidence";
  const median = medianAmount(amounts);
  if (median === null || median === 0) return "variable";
  const deviation = maxRelativeDeviation(amounts, median);
  if (deviation <= HIGHLY_STABLE_RELATIVE_TOLERANCE) return "highly_stable";
  if (detectPriceChange(amounts) !== null) return "moderately_stable";
  if (deviation <= VARIABLE_MAX_RELATIVE) return "moderately_stable";
  return "variable";
}

// Detect a clean old->new amount step: the first k payments sit tightly around
// one level and the rest around a second, higher/lower level, with a meaningful
// jump between them. Level tolerance is the same relative constant used
// elsewhere; the jump must exceed PRICE_CHANGE_MIN_RELATIVE.
export function detectPriceChange(amounts: number[]): RecurringPriceChange | null {
  const n = amounts.length;
  if (n < 3) return null;
  // Scan every split point; pick the smallest middle gap where both sides are
  // internally level-stable and the step is meaningful.
  for (let k = 1; k < n; k++) {
    const a = amounts.slice(0, k);
    const b = amounts.slice(k);
    const medA = medianAmount(a);
    const medB = medianAmount(b);
    if (medA === null || medB === null || medA === 0) continue;
    const jump = Math.abs(medB - medA) / Math.abs(medA);
    if (jump < PRICE_CHANGE_MIN_RELATIVE) continue;
    if (!isLevelStable(a, medA) || !isLevelStable(b, medB)) continue;
    return { from: medA, to: medB };
  }
  return null;
}

// All amounts within the relative tolerance of the given level median.
function isLevelStable(amounts: number[], levelMedian: number): boolean {
  if (levelMedian === 0) return false;
  for (const a of amounts) {
    if (Math.abs(a - levelMedian) / Math.abs(levelMedian) > AMOUNT_RELATIVE_TOLERANCE) {
      return false;
    }
  }
  return true;
}
