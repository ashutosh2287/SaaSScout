import type { NormalizedTransaction } from "../parse/types";

export type DuplicateCounts = { exact: number; possible: number };

function normDesc(desc: string): string {
  return desc.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cents(n: number): number {
  return Math.round(n * 100);
}

// O(n) duplicate detection using map keys.
// exact key: date + exact description + amount
// possible key: date + normalized description + amount
// Rows without a usable date are excluded (can't be confirmed as duplicates).
export function countDuplicates(transactions: NormalizedTransaction[]): DuplicateCounts {
  const exactGroups = new Map<string, number>();
  const possibleGroups = new Map<string, number>();

  for (const t of transactions) {
    if (!t.date) continue;
    const exactKey = `${t.date}|${t.description}|${cents(t.amount)}`;
    const possibleKey = `${t.date}|${normDesc(t.description)}|${cents(t.amount)}`;
    exactGroups.set(exactKey, (exactGroups.get(exactKey) ?? 0) + 1);
    possibleGroups.set(possibleKey, (possibleGroups.get(possibleKey) ?? 0) + 1);
  }

  const excess = (m: Map<string, number>) => {
    let sum = 0;
    for (const c of m.values()) if (c > 1) sum += c - 1;
    return sum;
  };

  const exact = excess(exactGroups);
  const possible = Math.max(0, excess(possibleGroups) - exact);
  return { exact, possible };
}