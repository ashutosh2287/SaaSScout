import type { NormalizedTransaction } from "../parse/types";

// Step 24 — comparison decision-value measurement scenario. Synthetic only;
// deterministic. Isolates the COMPARE surface (not the review queue): a 12-month
// SMB statement (2025-07-01..2026-06-30; baseline = months 0..5, current =
// months 6..11) whose software universe reuses Step 22's dictionary-backed
// merchant names, tuned so the comparison engine emits 13 findings that force
// the ordering question:
//
//   - two ended charges (one huge at 800/mo, one small at 20/mo) vs new charges,
//   - a huge-absolute / low-relative price increase (500->600, +20%) vs a
//     small-absolute / huge-relative one (10->20, +100%),
//   - a same-magnitude cross-kind tie (a new recurring 7/mo at the same |delta|
//     as two price increases),
//   - a frequency change, and three null-impact findings (became irregular,
//     appeared, disappeared) that must sink below every dollar finding.
//
// Ground truth is exported as EXPECTED (key -> kind) and the engine-observed
// ordering is measured in decision-value.test.ts against GT-A (materiality:
// |annualized delta|) and GT-B (direction-aware: costs before savings).

export const STEP24_START = "2025-07-01";
export const STEP24_BASELINE_END = "2026-01-01";
export const STEP24_CURRENT_END = "2026-06-30";

type RowDef = { date: string; description: string; amount: number };

function monthDate(i: number, day: number): string {
  const year = i < 6 ? 2025 : 2026;
  const month = i < 6 ? i + 7 : i - 5;
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.max(1, Math.min(day, 28))).padStart(2, "0")}`;
}

function dayOf(key: string): number {
  return 6 + (key.length % 18);
}

// Monthly merchant: one charge per month at a fixed amount, optionally stepping
// from month 6 onward. `months` can restrict a window so a merchant only exists
// in baseline (0..5) or current (6..11).
function monthly(
  key: string,
  desc: string,
  amount: number,
  months: number[],
  stepTo?: number,
): RowDef[] {
  const day = dayOf(key);
  return months.map((i) => ({
    date: monthDate(i, day),
    description: desc,
    amount: -amountFor(i, amount, stepTo),
  }));
}

function amountFor(i: number, base: number, stepTo?: number): number {
  return stepTo !== undefined && i >= 6 ? stepTo : base;
}

export function buildStep24Scenario(): { rows: RowDef[]; keysByType: Record<string, string[]> } {
  const rows: RowDef[] = [];
  const B = [0, 1, 2, 3, 4, 5];
  const C = [6, 7, 8, 9, 10, 11];

  rows.push(...monthly("slack", "SLACK TECHNOLOGIES INC", 800, B)); // Huge ended (savings).
  rows.push(...monthly("salesforce", "SALESFORCE.COM", 120, C)); // New recurring.
  rows.push(...monthly("microsoft", "MICROSOFT 365 SUBSCRIPTION", 500, [...B, ...C], 600)); // +20%, large abs.
  rows.push(...monthly("github", "GITHUB.COM INC", 200, [...B, ...C], 240)); // +20%, mid.
  rows.push(...monthly("netflix", "NETFLIX.COM", 10, [...B, ...C], 20)); // +100%, small abs.
  rows.push(...monthly("dropbox", "DROPBOX.COM", 40, [...B, ...C], 47)); // +17.5%, tie magnitude.
  rows.push(...monthly("zoom", "ZOOM.US", 40, [...B, ...C], 47)); // +17.5%, tie magnitude.
  rows.push(...monthly("trello", "TRELLO GOLD", 20, B)); // Small ended (savings).
  rows.push(...monthly("adobe", "ADOBE CREATIVE CLOUD", 7, C)); // New recurring, tie magnitude.

  // Frequency change: monthly in baseline, quarterly in current. Same per-charge
  // amount so no price step shadows the cadence change.
  const figDay = dayOf("figma");
  rows.push(
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ date: monthDate(i, figDay), description: "FIGMA PROFESSIONAL", amount: -50 })),
  );
  rows.push({ date: monthDate(6, figDay), description: "FIGMA PROFESSIONAL", amount: -50 });
  rows.push({ date: monthDate(9, figDay), description: "FIGMA PROFESSIONAL", amount: -50 });

  // Became irregular: monthly in baseline, scattered 3 charges in current.
  const openDay = dayOf("openai");
  rows.push(...[0, 1, 2, 3, 4, 5].map((i) => ({ date: monthDate(i, openDay), description: "OPENAI CHATGPT PLUS", amount: -250 })));
  rows.push({ date: monthDate(7, 4), description: "OPENAI CHATGPT PLUS", amount: -250 });
  rows.push({ date: monthDate(9, 19), description: "OPENAI CHATGPT PLUS", amount: -250 });
  rows.push({ date: monthDate(10, 6), description: "OPENAI CHATGPT PLUS", amount: -250 });

  // Non-recurring presence changes (one-off software purchases): appeared /
  // disappeared. A single charge never carries an interval, so these stay in
  // the informational lane.
  rows.push({ date: monthDate(9, 17), description: "NOTION LABS", amount: -85 });
  rows.push({ date: monthDate(2, 6), description: "CANVA PRO", amount: -90 });

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const keysByType: Record<string, string[]> = {
    ended: ["slack", "trello"],
    new: ["salesforce", "adobe"],
    increase: ["microsoft", "github", "netflix", "dropbox", "zoom"],
    frequency: ["figma"],
    irregular: ["openai"],
    appeared: ["notion"],
    disappeared: ["canva"],
  };
  return { rows, keysByType };
}

export function rowsToTransactions(rows: RowDef[]): NormalizedTransaction[] {
  return rows.map((r, i) => ({
    id: `s24${i}`,
    date: r.date,
    description: r.description,
    amount: r.amount,
    sourceRow: i + 2,
  }));
}

export function splitWindows(txns: NormalizedTransaction[]): {
  baseline: NormalizedTransaction[];
  current: NormalizedTransaction[];
} {
  return {
    baseline: txns.filter((t) => (t.date ?? "9999") >= STEP24_START && (t.date ?? "9999") < STEP24_BASELINE_END),
    current: txns.filter((t) => (t.date ?? "0000") >= STEP24_BASELINE_END && (t.date ?? "0000") <= STEP24_CURRENT_END),
  };
}

// Expected engine finding per merchant. Kept out of the scenario builder so the
// measurement test owns the ground truth.
export const EXPECTED_FINDING_KIND: Record<string, string> = {
  slack: "ended_recurring",
  trello: "ended_recurring",
  salesforce: "new_recurring",
  adobe: "new_recurring",
  microsoft: "price_increase",
  github: "price_increase",
  netflix: "price_increase",
  dropbox: "price_increase",
  zoom: "price_increase",
  figma: "frequency_change",
  openai: "pattern_irregular",
  notion: "merchant_appeared",
  canva: "merchant_disappeared",
};

// Expected engine-observed annualized deltas (day-based: 365/period).
export const EXPECTED_YEARLY: Record<string, number> = {
  slack: -(800 * (365 / 30)),   // -9733.33
  trello: -(20 * (365 / 30)),   // -243.33
  salesforce: 120 * (365 / 30), // +1460
  adobe: 7 * (365 / 30),        // +85.17
  microsoft: 100 * (365 / 30),  // +1216.67
  github: 40 * (365 / 30),      // +486.67
  netflix: 10 * (365 / 30),     // +121.67
  dropbox: 7 * (365 / 30),      // +85.17
  zoom: 7 * (365 / 30),         // +85.17
  figma: 50 * (365 / 90) - 50 * (365 / 30), // -405.56
  openai: 0, // null impact
  notion: 0,
  canva: 0,
};