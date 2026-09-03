import { LEVEL_FAIR, LEVEL_GOOD, MIN_DATE_COMPLETENESS } from "./constants";
import type { DataQualityDiagnostics, QualityLevel } from "./types";

// Deterministic, documented scoring penalties. Starting from 100, subtract per
// measured problem. Values are product heuristics, not statistical accuracy.

const PENALTY_INVALID_DATE = 6; // any invalid date
const PENALTY_MISSING_DATE = 1.5; // per missing date (capped below)
const PENALTY_MISSING_DESC = 1.5; // per missing description (capped below)
const PENALTY_ZERO_AMOUNT = 0.2; // per zero amount
const PENALTY_POSSIBLE_DUP = 1; // per possible duplicate
const PENALTY_EXACT_DUP = 2; // per exact duplicate
const PENALTY_LARGE_GAP = 8; // any significant gap
const PENALTY_SHORT_HISTORY = 12; // history shorter than the useful minimum
const PENALTY_SMALL_DATASET = 10; // very few transactions

const MAX_MISSING_DATE_PENALTY = 20;
const MAX_MISSING_DESC_PENALTY = 20;

export function mapLevel(score: number): QualityLevel {
  if (score >= LEVEL_GOOD) return "Good";
  if (score >= LEVEL_FAIR) return "Fair";
  return "Needs attention";
}

export function computeScore(d: DataQualityDiagnostics, hasSignificantGap: boolean, shortHistory: boolean, smallDataset: boolean): number {
  const { date, description, amount, duplicates } = d;

  let score = 100;
  if (date.invalid > 0) score -= PENALTY_INVALID_DATE;
  score -= Math.min(date.missing * PENALTY_MISSING_DATE, MAX_MISSING_DATE_PENALTY);
  score -= Math.min(description.missing * PENALTY_MISSING_DESC, MAX_MISSING_DESC_PENALTY);
  score -= amount.zero * PENALTY_ZERO_AMOUNT;
  score -= duplicates.possible * PENALTY_POSSIBLE_DUP;
  score -= duplicates.exact * PENALTY_EXACT_DUP;
  if (hasSignificantGap) score -= PENALTY_LARGE_GAP;
  if (shortHistory) score -= PENALTY_SHORT_HISTORY;
  if (smallDataset) score -= PENALTY_SMALL_DATASET;

  return Math.max(0, Math.round(score));
}

// Objectively assess readiness from measured counts.
export function determineReadiness(d: DataQualityDiagnostics): DataQualityDiagnostics["analysisReadiness"] {
  if (d.totalTransactions === 0) return "blocked";
  if (d.date.missing === d.totalTransactions) return "blocked"; // no usable dates at all
  const hasAnyAmount = d.amount.positive > 0 || d.amount.negative > 0;
  if (!hasAnyAmount) return "blocked"; // nothing usable
  if (d.date.present < d.totalTransactions * MIN_DATE_COMPLETENESS) return "needs_attention";
  return "ready";
}