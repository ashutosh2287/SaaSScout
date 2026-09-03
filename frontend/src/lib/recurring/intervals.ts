import {
  INTERVAL_CONSISTENCY_THRESHOLD,
  INTERVAL_WINDOW_ANNUAL,
  INTERVAL_WINDOW_MONTHLY,
  INTERVAL_WINDOW_QUARTERLY,
  INTERVAL_WINDOW_WEEKLY,
} from "./constants";
import type { RecurringInterval } from "./types";

const INTERVAL_WINDOWS: { interval: Exclude<RecurringInterval, null | "irregular">; min: number; max: number }[] = [
  { interval: "weekly", ...INTERVAL_WINDOW_WEEKLY },
  { interval: "monthly", ...INTERVAL_WINDOW_MONTHLY },
  { interval: "quarterly", ...INTERVAL_WINDOW_QUARTERLY },
  { interval: "annual", ...INTERVAL_WINDOW_ANNUAL },
];

// Largest neighboring-without-matching checkable interval target; if a gap is
// larger than every window it is irregular. Gaps that fit no window are null.

// Classify a single day-gap into at most one interval (prefer the closest, so a
// 30-day gap is monthly and a 91-day gap is quarterly, never ambiguous).
export function classifyGap(days: number): Exclude<RecurringInterval, null | "irregular"> | null {
  let best: { interval: Exclude<RecurringInterval, null | "irregular">; distance: number } | null = null;
  for (const w of INTERVAL_WINDOWS) {
    if (days >= w.min && days <= w.max) {
      const center = (w.min + w.max) / 2;
      const distance = Math.abs(days - center);
      if (!best || distance < best.distance) best = { interval: w.interval, distance };
    }
  }
  return best?.interval ?? null;
}

export type DominantInterval = {
  interval: RecurringInterval;
  gapCount: number;
  consistency: number;
};

// Given the day-gaps between consecutive payments, find the interval that
// explains the most gaps. Returns the dominant interval when enough gaps agree,
// otherwise "irregular".
export function dominantInterval(gaps: number[]): DominantInterval {
  if (gaps.length === 0) {
    return { interval: null, gapCount: 0, consistency: 0 };
  }

  const counts = new Map<string, number>();
  for (const g of gaps) {
    const cls = classifyGap(g);
    if (cls) counts.set(cls, (counts.get(cls) ?? 0) + 1);
  }

  let bestInterval: RecurringInterval = null;
  let bestCount = 0;
  for (const [interval, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestInterval = interval as RecurringInterval;
    }
  }

  const consistency = gaps.length > 0 ? bestCount / gaps.length : 0;
  if (bestInterval === null || consistency < INTERVAL_CONSISTENCY_THRESHOLD) {
    return { interval: "irregular", gapCount: 0, consistency };
  }
  return { interval: bestInterval, gapCount: bestCount, consistency };
}
