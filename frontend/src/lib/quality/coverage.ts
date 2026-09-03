import type { NormalizedTransaction } from "../parse/types";
import { SIGNIFICANT_DATE_GAP_DAYS } from "./constants";

export type Coverage = {
  earliest?: string;
  latest?: string;
  dateRangeDays?: number;
  monthsRepresented: number;
  transactionsByMonth: Record<string, number>;
  significantGapDays?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeCoverage(transactions: NormalizedTransaction[]): Coverage {
  const byMonth: Record<string, number> = {};
  let earliest: string | null = null;
  let latest: string | null = null;
  let maxGap = 0;

  const dated = transactions.filter((t): t is NormalizedTransaction & { date: string } => t.date !== null);
  const sorted = dated.map((t) => t.date).sort();

  for (const t of dated) {
    const month = t.date.slice(0, 7); // YYYY-MM
    byMonth[month] = (byMonth[month] ?? 0) + 1;
  }

  if (sorted.length > 0) {
    earliest = sorted[0];
    latest = sorted[sorted.length - 1];
    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.round((new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / DAY_MS);
      if (gap > maxGap) maxGap = gap;
    }
  }

  const dateRangeDays =
    earliest && latest ? Math.round((new Date(latest).getTime() - new Date(earliest).getTime()) / DAY_MS) + 1 : undefined;

  return {
    earliest: earliest ?? undefined,
    latest: latest ?? undefined,
    dateRangeDays,
    monthsRepresented: Object.keys(byMonth).length,
    transactionsByMonth: byMonth,
    significantGapDays: maxGap > SIGNIFICANT_DATE_GAP_DAYS ? maxGap : undefined,
  };
}