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

// A minimal binary min-heap (Stdlib-free; nothing in Node/browser exposes an
// indexable priority queue).
class MinHeap {
  private h: number[] = [];

  get size(): number {
    return this.h.length;
  }

  peek(): number {
    return this.h[0];
  }

  push(v: number): void {
    this.h.push(v);
    let i = this.h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.h[p] <= this.h[i]) break;
      const t = this.h[p];
      this.h[p] = this.h[i];
      this.h[i] = t;
      i = p;
    }
  }

  pop(): number {
    const top = this.h[0];
    const last = this.h.pop()!;
    if (this.h.length > 0) {
      this.h[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.h.length && this.h[l] < this.h[m]) m = l;
        if (r < this.h.length && this.h[r] < this.h[m]) m = r;
        if (m === i) break;
        const t = this.h[m];
        this.h[m] = this.h[i];
        this.h[i] = t;
        i = m;
      }
    }
    return top;
  }
}

// Exact running median over a growing set. `lower` (max-heap) holds the smaller
// half, `upper` (min-heap) the larger; |lower| is either |upper| or |upper|+1.
class RunningMedian {
  private lower = new MinHeap();
  private upper = new MinHeap();

  add(x: number): void {
    if (this.lower.size === 0 || x <= -this.lower.peek()) this.lower.push(-x);
    else this.upper.push(x);
    if (this.lower.size > this.upper.size + 1) this.upper.push(-this.lower.pop());
    else if (this.upper.size > this.lower.size) this.lower.push(-this.upper.pop());
  }

  median(): number {
    if (this.lower.size > this.upper.size) return -this.lower.peek();
    return (-this.lower.peek() + this.upper.peek()) / 2;
  }
}

// Detect a clean old->new amount step: the first k payments sit tightly around
// one level and the rest around a second, higher/lower level, with a meaningful
// jump between them. Level tolerance is the same relative constant used
// elsewhere; the jump must exceed PRICE_CHANGE_MIN_RELATIVE.
//
// O(n log n): prefix and suffix medians/min/max are precomputed with running
// medians, so each split point is O(1). The old implementation re-sorted both
// slices per split (O(n^2 log n)) and dominated the pipeline for any merchant
// with thousands of payments. Semantics are identical: same medians, same
// stability test, and the first valid split in scan order wins.
export function detectPriceChange(amounts: number[]): RecurringPriceChange | null {
  const n = amounts.length;
  if (n < 3) return null;

  // Suffix stats for amounts[k..n-1], built right-to-left.
  const sufMedian = new Array<number>(n);
  const sufMin = new Array<number>(n);
  const sufMax = new Array<number>(n);
  const suf = new RunningMedian();
  let mn = Infinity;
  let mx = -Infinity;
  for (let k = n - 1; k >= 1; k--) {
    const v = amounts[k];
    suf.add(v);
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    sufMedian[k] = suf.median();
    sufMin[k] = mn;
    sufMax[k] = mx;
  }

  // Scan split points in order; first clean step wins (matches prior behavior).
  const pre = new RunningMedian();
  let preMin = Infinity;
  let preMax = -Infinity;
  for (let k = 1; k < n; k++) {
    const v = amounts[k - 1];
    pre.add(v);
    if (v < preMin) preMin = v;
    if (v > preMax) preMax = v;

    const medA = pre.median();
    const medB = sufMedian[k];
    if (medA === 0) continue;
    const jump = Math.abs(medB - medA) / Math.abs(medA);
    if (jump < PRICE_CHANGE_MIN_RELATIVE) continue;
    if (!isLevelStable(preMin, preMax, medA) || !isLevelStable(sufMin[k], sufMax[k], medB)) continue;
    return { from: medA, to: medB };
  }
  return null;
}

// All amounts within the relative tolerance of the given level median. Checking
// the set's min and max is exact: the extremes maximise |amount - median|.
function isLevelStable(min: number, max: number, levelMedian: number): boolean {
  if (levelMedian === 0) return false;
  const tol = AMOUNT_RELATIVE_TOLERANCE * Math.abs(levelMedian);
  return Math.abs(levelMedian - min) <= tol && Math.abs(max - levelMedian) <= tol;
}
