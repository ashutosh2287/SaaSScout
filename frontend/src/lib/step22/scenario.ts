import type { NormalizedTransaction } from "../parse/types";
import { mulberry32 } from "../betatest/fixtures";

// Step 22 — decision-value measurement scenario. Synthetic only; deterministic.
//
// A 12-month SMB statement (2025-07-01 .. 2026-06-30; baseline = months 0..5,
// current = months 6..11) whose software universe reuses the STEP-21 merchant
// dictionary / description-signal names so classification is grounded in the
// real pipeline, plus bulk non-software noise so prioritization matters.
//
// Ground truth (exported as contracts):
//   - BIG_MONTHLY_KEYS: clean monthly software fees the owner would care about.
//   - PRICE_STEP_KEYS: monthly amount rises part-way through (comparison
//     price_increase); OPENAI's step is the single largest change in the file.
//   - ENDED_KEY / NEW_KEY: a subscription that ends / starts across windows.
//   - Every KEY's estimated monthly spend and expected finding are derivable
//     from the seeds below (see EXPECTED da in metrics.ts).

export type ScenarioSeed = {
  key: string;
  amount: number;
  cadence: "monthly" | "quarterly" | "irregular";
  variants: string[];
  perWeek?: number;
  count?: number;
  stepAfter?: number;
  stepTo?: number;
  window?: "both" | "baseline" | "current";
};

export type Scenario = {
  rows: { date: string; description: string; amount: number }[];
  // Ground-truth normalizedKey per source seed (null = generic noise).
  keyByIndexOrder: string[];
};

const SEED = 20260906;
const MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// ---------- Software seeds (dictionary/signal-backed) ----------

export const BIG_MONTHLY_SEEDS: ScenarioSeed[] = [
  { key: "github", amount: 299, cadence: "monthly", variants: ["GITHUB.COM INC", "GITHUB ENTERPRISE"] },
  { key: "adobe", amount: 250, cadence: "monthly", variants: ["ADOBE CREATIVE CLOUD", "ADOBE INC"] },
  { key: "microsoft", amount: 210, cadence: "monthly", variants: ["MICROSOFT 365 SUBSCRIPTION", "MICROSOFT 365"] },
  { key: "shopify", amount: 190, cadence: "monthly", variants: ["SHOPIFY INC", "SHOPIFY"] },
  { key: "zoom", amount: 165, cadence: "monthly", variants: ["ZOOM.US", "ZOOM VIDEO COMMUNICATIONS"] },
  { key: "canva", amount: 150, cadence: "monthly", variants: ["CANVA PRO", "CANVA.COM"] },
  { key: "notion", amount: 140, cadence: "monthly", variants: ["NOTION LABS", "NOTION.SO"] },
  { key: "dropbox", amount: 135, cadence: "monthly", variants: ["DROPBOX.COM", "DROPBOX INC"] },
];

// Step after month 6 → price_increase finding. OPENAI's step is deliberately the
// largest monetary change in the whole statement (+110/mo).
export const PRICE_STEP_SEEDS: ScenarioSeed[] = [
  { key: "openai", amount: 420, cadence: "monthly", variants: ["OPENAI CHATGPT PLUS", "OPENAI"], stepAfter: 6, stepTo: 530 },
  // 320 -> 380 (>15% material, +60/mo = $720/yr).
  { key: "hubspot", amount: 320, cadence: "monthly", variants: ["HUBSPOT", "HUBSPOT.COM"], stepAfter: 6, stepTo: 380 },
  { key: "google workspace", amount: 50, cadence: "monthly", variants: ["GOOGLE WORKSPACE", "GOOGLE WORKSPACE BILLING"], stepAfter: 6, stepTo: 75 },
  { key: "netflix", amount: 15.49, cadence: "monthly", variants: ["NETFLIX.COM", "NETFLIX"], stepAfter: 6, stepTo: 22.99 },
  { key: "figma", amount: 45, cadence: "quarterly", variants: ["FIGMA PROFESSIONAL", "FIGMA"], stepAfter: 6, stepTo: 54 },
];

export const MID_MONTHLY_SEEDS: ScenarioSeed[] = [
  { key: "slack", amount: 72, cadence: "monthly", variants: ["SLACK TECHNOLOGIES INC", "SLACK"] },
  { key: "trello", amount: 30, cadence: "monthly", variants: ["TRELLO GOLD", "TRELLO INC"] },
  { key: "spotify", amount: 26, cadence: "monthly", variants: ["SPOTIFY USA", "SPOTIFY AB"] },
  { key: "office 365", amount: 84, cadence: "monthly", variants: ["OFFICE 365 BUSINESS", "MICROSOFT OFFICE 365"] },
];

// Ended after baseline / started in current.
export const ENDED_SEED: ScenarioSeed = { key: "atlassian", amount: 80, cadence: "monthly", variants: ["ATLASSIAN CLOUD", "ATLASSIAN JIRA"], window: "baseline" };
export const NEW_SEED: ScenarioSeed = { key: "salesforce", amount: 60, cadence: "monthly", variants: ["SALESFORCE.COM", "SALESFORCE INC"], window: "current" };

// Irregular (honestly not monthly) and ambiguous merchants.
export const EDGE_SEEDS: ScenarioSeed[] = [
  { key: "aws", amount: 40, cadence: "irregular", variants: ["AWS", "AMAZON AWS"], count: 5 },
  { key: "amazon", amount: 55, cadence: "irregular", variants: ["AMAZON MKTP* US", "AMZN Mktp US"], count: 8 },
  { key: "paypal", amount: 75, cadence: "irregular", variants: ["PAYPAL TRANSFER", "PAYPAL *VENMO"], count: 4 },
  { key: "online subscription", amount: 9.99, cadence: "irregular", variants: ["ONLINE SUBSCRIPTION", "WEB SUB SVC"], count: 3 },
];

export const SOFTWARE_SEEDS: ScenarioSeed[] = [
  ...BIG_MONTHLY_SEEDS,
  ...PRICE_STEP_SEEDS,
  ...MID_MONTHLY_SEEDS,
  ENDED_SEED,
  NEW_SEED,
];

export const BIG_MONTHLY_KEYS = BIG_MONTHLY_SEEDS.map((s) => s.key);
export const PRICE_STEP_KEYS = PRICE_STEP_SEEDS.map((s) => s.key);
export const HIGH_VALUE_REVIEW_KEYS = [
  "openai", "hubspot", "github", "adobe", "microsoft", "shopify", "zoom",
  "canva", "notion", "dropbox", "atlassian",
];
// Comparison ground truth: |yearly delta| must clear $120 to be "high value".
export const HIGH_VALUE_FINDINGS = [
  { key: "openai", kind: "price_increase", yearly: 1320 },
  { key: "atlassian", kind: "ended_recurring", yearly: 960 },
  { key: "salesforce", kind: "new_recurring", yearly: 720 },
  { key: "hubspot", kind: "price_increase", yearly: 720 },
  { key: "google workspace", kind: "price_increase", yearly: 300 },
];

// Bulk non-software operational noise. Same shape as Step 20's fixture noise;
// clearly non-software categories so classification stays accurate at scale.
const BULK_VENDORS: ScenarioSeed[] = [
  { key: "marathon supply", cadence: "irregular", amount: 48, perWeek: 2, variants: ["MARATHON SUPPLY CO"] },
  { key: "grainger", cadence: "irregular", amount: 52, perWeek: 2, variants: ["W.W. GRAINGER"] },
  { key: "uline", cadence: "irregular", amount: 46, perWeek: 2, variants: ["ULINE SHIP SUPPLIES"] },
  { key: "staples", cadence: "irregular", amount: 44, perWeek: 2, variants: ["STAPLES ADVANTAGE"] },
  { key: "office depot", cadence: "irregular", amount: 49, perWeek: 2, variants: ["OFFICE DEPOT"] },
  { key: "msc industrial", cadence: "irregular", amount: 51, perWeek: 2, variants: ["MSC INDUSTRIAL DIRECT"] },
  { key: "hd supply", cadence: "irregular", amount: 47, perWeek: 2, variants: ["HD SUPPLY"] },
  { key: "fastenal", cadence: "irregular", amount: 42, perWeek: 2, variants: ["FASTENAL COMPANY"] },
  { key: "mcmaster carr", cadence: "irregular", amount: 55, perWeek: 2, variants: ["MCMASTER-CARR SUPPLY"] },
  { key: "ace hardware", cadence: "irregular", amount: 38, perWeek: 2, variants: ["ACE HARDWARE"] },
  { key: "sams club", cadence: "irregular", amount: 88, perWeek: 2, variants: ["SAM'S CLUB"] },
  { key: "sysco foods", cadence: "irregular", amount: 95, perWeek: 2, variants: ["SYSCO FOODS"] },
  { key: "us foods", cadence: "irregular", amount: 90, perWeek: 2, variants: ["US FOODS DIST"] },
  { key: "usps", cadence: "irregular", amount: 21, perWeek: 2, variants: ["USPS CLICK-N-SHIP"] },
  { key: "ups", cadence: "irregular", amount: 34, perWeek: 2, variants: ["UPS SHIPPING"] },
  { key: "fedex", cadence: "irregular", amount: 39, perWeek: 2, variants: ["FEDEX 3107"] },
  { key: "carwash express", cadence: "irregular", amount: 14, perWeek: 3, variants: ["CARWASH EXPRESS"] },
  { key: "quick printer", cadence: "irregular", amount: 27, perWeek: 3, variants: ["QUICK PRINT & COPY"] },
  { key: "cableco fees", cadence: "irregular", amount: 18, perWeek: 3, variants: ["CABLECO FRANCHISE FEE"] },
  { key: "whole foods", cadence: "irregular", amount: 68, perWeek: 2, variants: ["WHOLE FOODS MARKET"] },
  { key: "safeway", cadence: "irregular", amount: 46, perWeek: 2, variants: ["SAFEWAY GROCERY"] },
  { key: "target", cadence: "irregular", amount: 58, perWeek: 2, variants: ["TARGET"] },
  { key: "walmart", cadence: "irregular", amount: 62, perWeek: 2, variants: ["WALMART SUPERCENTER"] },
  { key: "home depot", cadence: "irregular", amount: 85, perWeek: 2, variants: ["HOME DEPOT"] },
  { key: "cvs pharmacy", cadence: "irregular", amount: 22, perWeek: 2, variants: ["CVS PHARMACY"] },
  { key: "walgreens", cadence: "irregular", amount: 19, perWeek: 2, variants: ["WALGREENS"] },
  { key: "uber", cadence: "irregular", amount: 18, perWeek: 2, variants: ["UBER *TRIP"] },
  { key: "shell fuel", cadence: "irregular", amount: 45, perWeek: 2, variants: ["SHELL OIL"] },
];

function monthDate(i: number, day: number): string {
  const year = i < 6 ? 2025 : 2026;
  const month = i < 6 ? i + 7 : i - 5;
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.max(1, Math.min(day, 28))).padStart(2, "0")}`;
}

function weekStart(w: number): Date {
  return new Date(Date.UTC(2025, 6, 7 + w * 7));
}

export function buildScenario(): Scenario {
  const rand = mulberry32(SEED);
  const out: { row: { date: string; description: string; amount: number }; key: string | null }[] = [];
  const jitter = (base: number) => {
    const sign = rand() < 0.5 ? -1 : 1;
    return Number((base * (1 + sign * rand() * 0.05)).toFixed(2));
  };

  const all: ScenarioSeed[] = [...SOFTWARE_SEEDS, ...EDGE_SEEDS, ...BULK_VENDORS];

  const emit = (seed: ScenarioSeed) => {
    const inWindow = (i: number) =>
      seed.window === "baseline" ? i < 6 : seed.window === "current" ? i >= 6 : true;
    const amountFor = (i: number) =>
      seed.stepAfter !== undefined && i >= seed.stepAfter && seed.stepTo !== undefined
        ? seed.stepTo
        : seed.amount;

    if (seed.perWeek && seed.perWeek > 0) {
      const weekdays = [0, 2, 4, 1, 3, 5, 6, 0, 3];
      let k = 0;
      for (let w = 0; w < 52; w++) {
        for (let v = 0; v < seed.perWeek * 2; v++) {
          const d = new Date(weekStart(w));
          d.setUTCDate(d.getUTCDate() + weekdays[k % weekdays.length]);
          const iso = d.toISOString().slice(0, 10);
          if (iso < "2025-07-01" || iso > "2026-06-30") continue;
          out.push({ row: { date: iso, description: seed.variants[k++ % seed.variants.length], amount: -jitter(seed.amount) }, key: seed.key });
        }
      }
      return;
    }

    if (seed.cadence === "irregular") {
      const h = seed.key.length;
      const months = [(h * 5 + 2) % 12, (h * 7 + 1) % 12, (h * 3 + 9) % 12, (h * 9) % 12, (h * 11 + 4) % 12];
      const count = seed.count ?? 4;
      const day = 4 + (h % 20);
      for (let k = 0; k < count; k++) {
        const i = months[k % months.length];
        if (!inWindow(i)) continue;
        out.push({ row: { date: monthDate(i, day + k), description: seed.variants[k % seed.variants.length], amount: -jitter(amountFor(i)) }, key: seed.key });
      }
      return;
    }

    const day = 6 + (seed.key.length % 18);
    const quarter = seed.cadence === "quarterly";
    // One stable description per merchant (first variant): description cycling
    // would split a merchant across keys and downgrade real recurring strength.
    const variant = seed.variants[0];
    for (const i of MONTHS) {
      if (quarter && ![0, 3, 6, 9].includes(i)) continue;
      if (!inWindow(i)) continue;
      out.push({ row: { date: monthDate(i, day), description: variant, amount: -amountFor(i) }, key: seed.key });
    }
  };

  for (const seed of all) emit(seed);

  out.sort((a, b) => (a.row.date < b.row.date ? -1 : a.row.date > b.row.date ? 1 : 0));
  return { rows: out.map((e) => e.row), keyByIndexOrder: out.map((e) => e.key ?? "noise") };
}

export function rowsToTransactions(rows: Scenario["rows"]): NormalizedTransaction[] {
  return rows.map((r, i) => ({
    id: `s22${i}`,
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
    baseline: txns.filter((t) => (t.date ?? "9999") >= "2025-07-01" && (t.date ?? "9999") < "2026-01-01"),
    current: txns.filter((t) => (t.date ?? "0000") >= "2026-01-01" && (t.date ?? "0000") <= "2026-06-30"),
  };
}