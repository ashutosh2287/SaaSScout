import type { NormalizedTransaction } from "../parse/types";

// Step 20 — real-world beta fixtures. Synthetic only; never real financial data.
//
// A 12-month SMB-style account statement (2025-07-01 .. 2026-06-30) built from
// an enumerated merchant universe. Baseline window = 2025-07..2025-12,
// current window = 2026-01..2026-06. Every merchant is keyed by its expected
// normalized merchant identity so ground truth is a first-class contract, and
// the whole thing is deterministic (mulberry32 seed) so measurements are
// repeatable across runs.
//
// Ground truth contract:
//   - SOFTWARE_EXPECTED_KEYS: must classify as software/SaaS.
//   - NON_SOFTWARE_EXPECTED_KEYS: must NOT classify as software.
//   - AMBIGUOUS_EXPECTED_KEYS: honest "unknown" is correct.
//   - RECURRING_MONTHLY_KEYS / RECURRING_QUARTERLY_KEYS: cadence must match.
//   - Comparison events: atlassian ends after baseline (ended_recurring),
//     salesforce starts in current (new_recurring), netflix price steps
//     (price_increase), aws is irregular, figma is quarterly.

export type RawRow = {
  date: string;
  description: string;
  amount: number;
};

export type SeedMerchant = {
  key: string;
  category: "software" | "non_software" | "ambiguous";
  cadence: "monthly" | "quarterly" | "annual" | "irregular";
  amount: number;
  variants: string[];
  perWeek?: number;
  count?: number;
  omitMonths?: number[];
  stepAfter?: number;
  stepTo?: number;
  window?: "baseline" | "current" | "both";
};

export type Statement = {
  rows: RawRow[];
  byKey: Map<string, SeedMerchant>;
  baselineRows: RawRow[];
  currentRows: RawRow[];
  /** Ground-truth seed key for each RowRow (parallel to `rows`; null = noise). */
  seedByRowIndex: (string | null)[];
};

const SEED = 20250906;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function monthDate(m: number, day: number): string {
  const year = m < 6 ? 2025 : 2026;
  const month = m < 6 ? m + 7 : m - 5;
  const dd = String(Math.max(1, Math.min(day, 28))).padStart(2, "0");
  return `${year}-${String(month).padStart(2, "0")}-${dd}`;
}

function weekStart(w: number): Date {
  return new Date(Date.UTC(2025, 6, 7 + w * 7));
}

const MONTHLY_RANGE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const QUARTERLY_RANGE = [0, 3, 6, 9];

export const SOFTWARE_SEEDS: SeedMerchant[] = [
  { key: "adobe", category: "software", cadence: "monthly", amount: 59.99, variants: ["ADOBE *CREATIVE CLOUD", "ADOBE INC", "ADOBE #9901"] },
  { key: "slack", category: "software", cadence: "monthly", amount: 8, variants: ["SLACK TECHNOLOGIES INC", "SLACK", "SLACK TECH INC"] },
  { key: "microsoft", category: "software", cadence: "monthly", amount: 12.99, variants: ["MICROSOFT 365 SUBSCRIPTION", "MICROSOFT 365", "MSFT"] },
  { key: "spotify", category: "software", cadence: "monthly", amount: 10.99, variants: ["SPOTIFY USA", "SPOTIFY", "SPOTIFY AB"], omitMonths: [8] },
  { key: "zoom", category: "software", cadence: "monthly", amount: 14.99, variants: ["ZOOM.US", "ZOOM VIDEO COMMUNICATIONS", "ZOOM.US AUDIO"] },
  { key: "openai", category: "software", cadence: "monthly", amount: 20, variants: ["OPENAI CHATGPT PLUS", "OPENAI", "CHATGPT"] },
  { key: "shopify", category: "software", cadence: "monthly", amount: 29, variants: ["SHOPIFY INC", "SHOPIFY", "SHOPIFY"] },
  { key: "trello", category: "software", cadence: "monthly", amount: 5, variants: ["TRELLO GOLD", "TRELLO", "TRELLO INC"] },
  { key: "hubspot", category: "software", cadence: "monthly", amount: 45, variants: ["HUBSPOT", "HUBSPOT.COM", "HUBSPOT INC"] },
  { key: "dropbox", category: "software", cadence: "monthly", amount: 11.99, variants: ["DROPBOX.COM", "DROPBOX", "DROPBOX INC"] },
  { key: "canva", category: "software", cadence: "monthly", amount: 12.95, variants: ["CANVA PRO", "CANVA", "CANVA.COM"] },
  { key: "github", category: "software", cadence: "monthly", amount: 4, variants: ["GITHUB.COM INC", "GITHUB", "GITHUB.COM"] },
  { key: "notion", category: "software", cadence: "monthly", amount: 10, variants: ["NOTION LABS", "NOTION", "NOTION.SO"] },
  // Scenario: price step from current window → price_increase expected.
  { key: "netflix", category: "software", cadence: "monthly", amount: 15.49, variants: ["NETFLIX.COM", "NETFLIX", "NETFLIX STREAMING"], stepAfter: 6, stepTo: 19.99 },
  // Scenario: cancelled after baseline → ended_recurring expected.
  { key: "atlassian", category: "software", cadence: "monthly", amount: 17, variants: ["ATLASSIAN CLOUD", "ATLASSIAN", "ATLASSIAN JIRA"], window: "baseline" },
  // Scenario: subscription started in current window → new_recurring expected.
  { key: "salesforce", category: "software", cadence: "monthly", amount: 25, variants: ["SALESFORCE.COM", "SALESFORCE", "SALESFORCE INC"], window: "current" },
  // Quarterly cadence → RECURRING_QUARTERLY.
  { key: "figma", category: "software", cadence: "quarterly", amount: 45, variants: ["FIGMA PROFESSIONAL", "FIGMA", "FIGMA DESIGN"] },
  // Irregular scattered spend → honestly irregular, never clean monthly.
  { key: "aws", category: "software", cadence: "irregular", amount: 40, count: 5, variants: ["AWS", "AWS", "AWS"] },
];

export const NON_SOFTWARE_SEEDS: SeedMerchant[] = [
  // Weekly lifestyle volume.
  { key: "dip st coffee", category: "non_software", cadence: "monthly", amount: 6.5, variants: ["DIP & DUNK COFFEE", "DIP N DUNK #104"], perWeek: 5 },
  { key: "velvet bean coffee", category: "non_software", cadence: "monthly", amount: 7.25, variants: ["VELVET BEAN ROASTER", "VELVET BEAN"], perWeek: 3 },
  { key: "sweetgreen", category: "non_software", cadence: "monthly", amount: 14.5, variants: ["SWEETGREEN", "SWEETGREEN SALAD"], perWeek: 3 },
  { key: "chipotle", category: "non_software", cadence: "monthly", amount: 13.75, variants: ["CHIPOTLE 04512", "CHIPOTLE MEXICAN GRILL"], perWeek: 2 },
  { key: "locals bistro", category: "non_software", cadence: "monthly", amount: 42, variants: ["LOCALS BISTRO", "LOCALS BISTRO LLC"], perWeek: 1 },
  { key: "whole foods", category: "non_software", cadence: "monthly", amount: 68, variants: ["WHOLE FOODS MARKET", "WFM 10697"], perWeek: 1 },
  { key: "trader joes", category: "non_software", cadence: "monthly", amount: 54, variants: ["TRADER JOE'S #321", "TRADER JOES"], perWeek: 1 },
  { key: "safeway", category: "non_software", cadence: "monthly", amount: 46, variants: ["SAFEWAY GROCERY", "SAFEWAY 3851"], perWeek: 1 },
  { key: "uber", category: "non_software", cadence: "monthly", amount: 18, variants: ["UBER *TRIP", "UBER *UBER EATS"], perWeek: 3 },
  { key: "lyft", category: "non_software", cadence: "monthly", amount: 17, variants: ["LYFT RIDE", "LYFT"], perWeek: 2 },
  { key: "shell fuel", category: "non_software", cadence: "monthly", amount: 45, variants: ["SHELL OIL 57441", "SHELL FUEL"], perWeek: 2 },
  { key: "chevron", category: "non_software", cadence: "monthly", amount: 41, variants: ["CHEVRON STATION", "CHEVRON USA"], perWeek: 1 },
  { key: "best buy", category: "non_software", cadence: "monthly", amount: 120, variants: ["BEST BUY #581", "BEST BUY"], perWeek: 1 },
  { key: "home depot", category: "non_software", cadence: "monthly", amount: 85, variants: ["HOME DEPOT #4621", "THE HOME DEPOT"], perWeek: 1 },
  { key: "walmart", category: "non_software", cadence: "monthly", amount: 62, variants: ["WALMART SUPERCENTER", "WALMART.COM"], perWeek: 1 },
  { key: "target", category: "non_software", cadence: "monthly", amount: 58, variants: ["TARGET 00018047", "TARGET.COM"], perWeek: 1 },
  { key: "costco", category: "non_software", cadence: "monthly", amount: 95, variants: ["COSTCO WHSE #470", "COSTCO GAS"], perWeek: 1 },
  { key: "cvs pharmacy", category: "non_software", cadence: "monthly", amount: 22, variants: ["CVS PHARMACY #6375", "CVS/PHARMACY"], perWeek: 3 },
  { key: "walgreens", category: "non_software", cadence: "monthly", amount: 19, variants: ["WALGREENS #3587", "WALGREENS"], perWeek: 2 },
  { key: "7 eleven", category: "non_software", cadence: "monthly", amount: 8.5, variants: ["7-ELEVEN 34179", "SEVEN ELEVEN"], perWeek: 2 },
  { key: "amc theatre", category: "non_software", cadence: "monthly", amount: 24, variants: ["AMC THEATRES", "AMC ONLINE"], perWeek: 1 },
  // Monthly household.
  { key: "planet fitness", category: "non_software", cadence: "monthly", amount: 24.99, variants: ["PLANET FITNESS", "PLANET FITNESS 00218"], omitMonths: [7] },
  { key: "xfinity", category: "non_software", cadence: "monthly", amount: 89.99, variants: ["COMCAST XFINITY", "XFINITY INTERNET"] },
  { key: "at&t", category: "non_software", cadence: "monthly", amount: 75, variants: ["AT&T WIRELESS", "AT&T BILL PAY"] },
  { key: "pge electric", category: "non_software", cadence: "monthly", amount: 96, variants: ["PG&E ELECTRIC", "PG&E"] },
  { key: "city water", category: "non_software", cadence: "monthly", amount: 34, variants: ["CITY WATER UTILITY", "MUNI WATER"] },
  { key: "geico", category: "non_software", cadence: "monthly", amount: 112, variants: ["GEICO AUTO INSURANCE", "GEICO PIF"] },
  { key: "applecreek lease", category: "non_software", cadence: "monthly", amount: 1450, variants: ["APPLE CREEK LEASING", "APPLECREEK RENT"] },
  // Quarterly / sporadic.
  { key: "ca dmv", category: "non_software", cadence: "quarterly", amount: 140, variants: ["CA DMV REGISTRATION", "CA DMV FEES"] },
  { key: "crunch fitness", category: "non_software", cadence: "irregular", amount: 30, count: 4, variants: ["CRUNCH FITNESS", "CRUNCH GYM"] },
  { key: "petsmart", category: "non_software", cadence: "irregular", amount: 40, count: 5, variants: ["PETSMART #1141", "PETSMART"] },
];

// Bulk SMB operational vendors — supplies, inventory, logistics, retail. All
// clearly non-software; gives the statement real volume (5k+ rows) while
// remaining fully enumerated for ground-truth accounting.
const BULK_VENDOR_BASES: { key: string; variants: string[][]; perWeek: number }[] = [
  { key: "marathon supply", variants: [["MARATHON SUPPLY CO", "MARATHON SUPPLY #402"]], perWeek: 2 },
  { key: "grainger", variants: [["W.W. GRAINGER", "GRAINGER MRO"]], perWeek: 2 },
  { key: "uline", variants: [["ULINE SHIP SUPPLIES", "ULINE"]], perWeek: 2 },
  { key: "staples", variants: [["STAPLES ADVANTAGE", "STAPLES 1067"]], perWeek: 2 },
  { key: "office depot", variants: [["OFFICE DEPOT", "ODP BUSINESS SOLUTIONS"]], perWeek: 2 },
  { key: "msc industrial", variants: [["MSC INDUSTRIAL DIRECT", "MSCINDUSTRIAL"]], perWeek: 2 },
  { key: "hd supply", variants: [["HD SUPPLY BLDG MATLS", "HD SUPPLY"]], perWeek: 2 },
  { key: "fastenal", variants: [["FASTENAL COMPANY", "FASTENAL"]], perWeek: 2 },
  { key: "mcmaster carr", variants: [["MCMASTER-CARR SUPPLY", "MCMASTER-CARR"]], perWeek: 2 },
  { key: "ace hardware", variants: [["ACE HARDWARE #4362", "ACE HARDWARE"]], perWeek: 2 },
  { key: "true value", variants: [["TRUE VALUE COOP", "TRUE VALUE HARDWARE"]], perWeek: 2 },
  { key: "sams club", variants: [["SAM'S CLUB #8177", "SAMS CLUB"]], perWeek: 2 },
  { key: "sysco foods", variants: [["SYSCO FOODS", "SYSCO KB-15"]], perWeek: 2 },
  { key: "us foods", variants: [["US FOODS DIST", "US FOODS"]], perWeek: 2 },
  { key: "pkg world", variants: [["PACKAGING WORLD INC", "PKG WORLD"]], perWeek: 2 },
  { key: "solid packaging", variants: [["SOLID BAGS & BOXES", "SOLID PACKAGING"]], perWeek: 2 },
  { key: "riverbend clean", variants: [["RIVERBEND CLEANING SVC", "RIVERBEND JANITORIAL"]], perWeek: 2 },
  { key: "janitorial direct", variants: [["JANITORIAL DIRECT", "JANSUPPLY"]], perWeek: 2 },
  { key: "safety equip", variants: [["SAFETY EQUIP CO", "SAFETY GEAR USA"]], perWeek: 2 },
  { key: "toolzone", variants: [["TOOLZONE DISTRIBUTORS", "TOOL ZONE"]], perWeek: 2 },
  { key: "usps", variants: [["USPS CLICK-N-SHIP", "USPS POSTAGE"]], perWeek: 2 },
  { key: "ups", variants: [["UPS SHIPPING", "UPS.COM"]], perWeek: 2 },
  { key: "fedex", variants: [["FEDEX 3107", "FEDEX FREIGHT"]], perWeek: 2 },
  { key: "carwash express", variants: [["CARWASH EXPRESS #22", "CARWASH EXPRESS"]], perWeek: 3 },
  { key: "quick printer", variants: [["QUICK PRINT & COPY", "QUICKPRINT SHOP"]], perWeek: 3 },
  { key: "cableco fees", variants: [["CABLECO FRANCHISE FEE", "CABLECO"]], perWeek: 3 },
];

export const AMBIGUOUS_SEEDS: SeedMerchant[] = [
  { key: "amazon", category: "ambiguous", cadence: "irregular", amount: 55, count: 8, variants: ["AMAZON MKTP* US", "AMZN Mktp US", "AMAZON.COM"] },
  { key: "paypal", category: "ambiguous", cadence: "irregular", amount: 75, count: 4, variants: ["PAYPAL TRANSFER", "PAYPAL *VENMO"] },
  { key: "online subscription", category: "ambiguous", cadence: "irregular", amount: 9.99, count: 3, variants: ["ONLINE SUBSCRIPTION", "WEB SUB SVC"] },
];

export const SOFTWARE_EXPECTED_KEYS = SOFTWARE_SEEDS.map((s) => s.key);
export const NON_SOFTWARE_EXPECTED_KEYS = NON_SOFTWARE_SEEDS.map((s) => s.key);
export const BULK_VENDOR_KEYS = BULK_VENDOR_BASES.map((s) => s.key);
export const AMBIGUOUS_EXPECTED_KEYS = AMBIGUOUS_SEEDS.map((s) => s.key);
export const RECURRING_MONTHLY_KEYS = [
  "adobe", "slack", "microsoft", "spotify", "zoom", "openai", "shopify",
  "trello", "hubspot", "dropbox", "canva", "github", "notion", "netflix",
  "atlassian", "salesforce",
];
export const RECURRING_QUARTERLY_KEYS = ["figma"];
export const ENDED_AFTER_BASELINE_KEYS = ["atlassian"];
export const NEW_IN_CURRENT_KEYS = ["salesforce"];
export const PRICE_STEP_KEYS = ["netflix"];
export const IRREGULAR_KEYS = ["aws"];

function inWindow(seed: SeedMerchant, m: number): boolean {
  return seed.window === "baseline" ? m < 6 : seed.window === "current" ? m >= 6 : true;
}

function emit(
  seed: SeedMerchant,
  rand: () => number,
): RawRow[] {
  const rows: RawRow[] = [];
  const jitter = (base: number) => {
    const sign = rand() < 0.5 ? -1 : 1;
    return Number((base * (1 + sign * rand() * 0.05)).toFixed(2));
  };
  const desc = (i: number) => seed.variants[i % seed.variants.length];
  const amountFor = (m: number) =>
    seed.stepAfter !== undefined && m >= seed.stepAfter && seed.stepTo !== undefined
      ? seed.stepTo
      : seed.amount;

  if (seed.perWeek && seed.perWeek > 0) {
    const weekdays = [0, 2, 4, 1, 3, 5, 6, 0, 3];
    let i = 0;
    for (let w = 0; w < 52; w++) {
      for (let v = 0; v < seed.perWeek; v++) {
        const d = new Date(weekStart(w));
        d.setUTCDate(d.getUTCDate() + weekdays[i % weekdays.length]);
        const iso = d.toISOString().slice(0, 10);
        if (iso < "2025-07-01" || iso > "2026-06-30") continue;
        rows.push({ date: iso, description: desc(i++), amount: -jitter(seed.amount) });
      }
    }
    return rows;
  }

  const day = 4 + (seed.key.length % 20);
  const months =
    seed.cadence === "quarterly" ? QUARTERLY_RANGE : MONTHLY_RANGE;

  if (seed.cadence === "irregular" && seed.count) {
    const h = seed.key.length;
    const months = [
      (h * 5 + 2) % 12,
      (h * 7 + 1) % 12,
      (h * 3 + 9) % 12,
      (h * 9) % 12,
      (h * 11 + 4) % 12,
    ];
    for (let k = 0; k < seed.count; k++) {
      const m = months[k % months.length];
      if (seed.omitMonths?.includes(m)) continue;
      if (!inWindow(seed, m)) continue;
      rows.push({ date: monthDate(m, day + k), description: desc(k), amount: -jitter(amountFor(m)) });
    }
    return rows;
  }

  for (const m of months) {
    if (!inWindow(seed, m)) continue;
    if (seed.omitMonths?.includes(m)) continue;
    const idx = rows.length;
    rows.push({ date: monthDate(m, day), description: desc(idx), amount: -amountFor(m) });
  }
  return rows;
}

export function buildStatement(): Statement {
  const rand = mulberry32(SEED);
  const entries: { row: RawRow; key: string }[] = [];
  const byKey = new Map<string, SeedMerchant>();

  const all: SeedMerchant[] = [
    ...SOFTWARE_SEEDS,
    ...NON_SOFTWARE_SEEDS,
    ...BULK_VENDOR_BASES.map((b, i) => ({
      key: b.key,
      category: "non_software" as const,
      cadence: "irregular" as const,
      amount: 45 + i * 2.5,
      variants: b.variants[0],
      perWeek: b.perWeek,
    })),
    ...AMBIGUOUS_SEEDS,
  ];

  for (const seed of all) {
    const got = emit(seed, rand);
    byKey.set(seed.key, seed);
    entries.push(...got.map((row) => ({ row, key: seed.key })));
  }

  // A handful of exact-duplicate-looking double charges — realistic, and they
  // exercise the EXACT_DUPLICATES quality warning honestly. Marked as their
  // source seed with a distinct suffix so ground-truth mapping stays exact.
  const dupSources = entries.filter((e, i) => i % 137 === 0 && e.key).slice(0, 6);
  for (const e of dupSources) {
    entries.push({ row: { ...e.row, description: `${e.row.description} (DUP)` }, key: e.key });
  }

  // Chronological order like a real bank export keeps identity fragments from
  // grouping suspiciously while every line is still traceable to its seed.
  entries.sort((a, b) => (a.row.date < b.row.date ? -1 : a.row.date > b.row.date ? 1 : 0));

  const rows = entries.map((e) => e.row);
  const seedByRowIndex = entries.map((e) => e.key);
  const baselineRows = rows.filter((r) => r.date >= "2025-07-01" && r.date < "2026-01-01");
  const currentRows = rows.filter((r) => r.date >= "2026-01-01" && r.date <= "2026-06-30");
  return { rows, byKey, baselineRows, currentRows, seedByRowIndex };
}

export function toCsv(rows: RawRow[], header = ["Date", "Description", "Amount"]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([esc(r.date), esc(r.description), r.amount.toFixed(2)].join(","));
  }
  return lines.join("\n");
}

export function rowsToTransactions(rows: RawRow[]): NormalizedTransaction[] {
  return rows.map((r, i) => ({
    id: `fx${i}`,
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