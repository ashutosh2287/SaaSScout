import type { NormalizedTransaction } from "../parse/types";

// Phase 17 benchmark — synthetic, anonymized 3-month statement.
// Never real financial data. Realistic merchants, aliases, refunds, lookalikes,
// non-software spend, and weak-keyword noise, so honest-beta measurements have
// a defined denominator.
//
// Ground-truth contract:
//   - BENCHMARK_SOFTWARE_EXPECTED: normalizedKeys that SHOULD classify as
//     software/SaaS.
//   - BENCHMARK_NON_SOFTWARE_EXPECTED: keys that must stay not_software.
//   - BENCHMARK_AMBIGUOUS_KEYS: keys where unknown is the honest answer.
//   - BENCHMARK_HARD_CASES: known coverage limits tracked explicitly (never
//     silently regressed to a false "fixed").
// Measurements compare pipeline output against this contract.

export const BENCHMARK_TXNS: NormalizedTransaction[] = [
  // ── Software / SaaS (monthly cadence, alias variations) ──
  { id: "b1", date: "2026-01-04", description: "ADOBE *CREATIVE CLOUD 800-555-0188", amount: -59.99, sourceRow: 2 },
  { id: "b2", date: "2026-02-04", description: "ADOBE *CREATIVE CLOUD 800-555-0188", amount: -60.0, sourceRow: 20 },
  { id: "b3", date: "2026-03-04", description: "ADOBE *CREATIVE CLOUD", amount: -59.99, sourceRow: 38 },
  { id: "b4", date: "2026-01-11", description: "SLACK TECHNOLOGIES INC", amount: -8.0, sourceRow: 3 },
  { id: "b5", date: "2026-02-11", description: "SLACK", amount: -8.0, sourceRow: 21 },
  { id: "b6", date: "2026-03-11", description: "SLACK TECH INC", amount: -8.0, sourceRow: 39 },
  { id: "b7", date: "2026-01-14", description: "FIGMA", amount: -15.0, sourceRow: 4 },
  { id: "b8", date: "2026-02-14", description: "FIGMA", amount: -15.0, sourceRow: 22 },
  { id: "b9", date: "2026-03-14", description: "FIGMA", amount: -15.0, sourceRow: 40 },
  { id: "b10", date: "2026-01-06", description: "MICROSOFT 365 SUBSCRIPTION", amount: -12.99, sourceRow: 5 },
  { id: "b11", date: "2026-02-06", description: "MICROSOFT 365", amount: -12.99, sourceRow: 23 },
  { id: "b12", date: "2026-03-06", description: "MSFT", amount: -12.99, sourceRow: 41 },
  { id: "b13", date: "2026-01-17", description: "NETFLIX.COM", amount: -15.49, sourceRow: 6 },
  { id: "b14", date: "2026-02-17", description: "NETFLIX", amount: -15.49, sourceRow: 24 },
  { id: "b15", date: "2026-03-17", description: "NETFLIX.COM", amount: -15.49, sourceRow: 42 },
  { id: "b16", date: "2026-01-21", description: "SPOTIFY USA", amount: -10.99, sourceRow: 7 },
  { id: "b17", date: "2026-02-21", description: "SPOTIFY", amount: -10.99, sourceRow: 25 },
  { id: "b18", date: "2026-03-21", description: "SPOTIFY AB", amount: -10.99, sourceRow: 43 },
  { id: "b19", date: "2026-01-08", description: "ZOOM.US", amount: -14.99, sourceRow: 8 },
  { id: "b20", date: "2026-02-08", description: "ZOOM VIDEO COMMUNICATIONS", amount: -14.99, sourceRow: 26 },
  { id: "b21", date: "2026-03-08", description: "ZOOM.US AUDIO", amount: -14.99, sourceRow: 44 },
  { id: "b22", date: "2026-01-23", description: "OPENAI CHATGPT PLUS", amount: -20.0, sourceRow: 9 },
  { id: "b23", date: "2026-02-23", description: "OPENAI", amount: -20.0, sourceRow: 27 },
  { id: "b24", date: "2026-03-23", description: "CHATGPT", amount: -20.0, sourceRow: 45 },
  { id: "b25", date: "2026-01-27", description: "SHOPIFY INC", amount: -29.0, sourceRow: 10 },
  { id: "b26", date: "2026-02-27", description: "SHOPIFY", amount: -29.0, sourceRow: 28 },
  { id: "b27", date: "2026-03-27", description: "SHOPIFY", amount: -29.0, sourceRow: 46 },
  { id: "b28", date: "2026-01-05", description: "TRELLO GOLD", amount: -5.0, sourceRow: 11 },
  { id: "b29", date: "2026-02-05", description: "TRELLO", amount: -5.0, sourceRow: 29 },
  { id: "b30", date: "2026-03-05", description: "TRELLO INC", amount: -5.0, sourceRow: 47 },
  { id: "b31", date: "2026-01-13", description: "ATLASSIAN CLOUD", amount: -17.0, sourceRow: 12 },
  { id: "b32", date: "2026-02-13", description: "JIRA", amount: -17.0, sourceRow: 30 },
  { id: "b33", date: "2026-03-13", description: "CONFLUENCE", amount: -17.0, sourceRow: 48 },
  { id: "b34", date: "2026-01-19", description: "SALESFORCE.COM", amount: -25.0, sourceRow: 13 },
  { id: "b35", date: "2026-02-19", description: "SALESFORCE", amount: -25.0, sourceRow: 31 },
  { id: "b36", date: "2026-03-19", description: "SALESFORCE INC", amount: -25.0, sourceRow: 49 },
  { id: "b37", date: "2026-01-28", description: "HUBSPOT", amount: -45.0, sourceRow: 14 },
  { id: "b38", date: "2026-02-28", description: "HUBSPOT.COM", amount: -45.0, sourceRow: 32 },
  { id: "b39", date: "2026-03-28", description: "HUBSPOT INC", amount: -45.0, sourceRow: 50 },
  { id: "b40", date: "2026-01-03", description: "DROPBOX.COM", amount: -11.99, sourceRow: 15 },
  { id: "b41", date: "2026-02-03", description: "DROPBOX", amount: -11.99, sourceRow: 33 },
  { id: "b42", date: "2026-03-03", description: "DROPBOX INC", amount: -11.99, sourceRow: 51 },
  { id: "b43", date: "2026-01-24", description: "CANVA PRO", amount: -12.95, sourceRow: 16 },
  { id: "b44", date: "2026-02-24", description: "CANVA", amount: -12.95, sourceRow: 34 },
  { id: "b45", date: "2026-03-24", description: "CANVA.COM", amount: -12.95, sourceRow: 52 },
  { id: "b46", date: "2026-01-15", description: "GITHUB.COM INC", amount: -4.0, sourceRow: 17 },
  { id: "b47", date: "2026-02-15", description: "GITHUB", amount: -4.0, sourceRow: 35 },
  { id: "b48", date: "2026-03-15", description: "GITHUB.COM", amount: -4.0, sourceRow: 53 },
  { id: "b49", date: "2026-01-18", description: "NOTION LABS", amount: -10.0, sourceRow: 18 },
  { id: "b50", date: "2026-02-18", description: "NOTION", amount: -10.0, sourceRow: 36 },
  { id: "b51", date: "2026-03-18", description: "NOTION.SO", amount: -10.0, sourceRow: 54 },
  { id: "b52", date: "2026-01-20", description: "AWS", amount: -10.0, sourceRow: 1 },
  { id: "b53", date: "2026-02-20", description: "AWS", amount: -10.0, sourceRow: 19 },
  { id: "b54", date: "2026-03-20", description: "AWS", amount: -10.0, sourceRow: 37 },

  // ── Non-software (recurring-style + one-off) ──
  { id: "b55", date: "2026-01-02", description: "GROCERY STORE", amount: -45.5, sourceRow: 56 },
  { id: "b56", date: "2026-02-02", description: "GROCERY STORE", amount: -52.0, sourceRow: 57 },
  { id: "b57", date: "2026-03-02", description: "GROCERY STORE", amount: -48.3, sourceRow: 58 },
  { id: "b58", date: "2026-01-09", description: "FRED'S RESTAURANT", amount: -22.0, sourceRow: 59 },
  { id: "b59", date: "2026-01-16", description: "SHELL FUEL", amount: -40.0, sourceRow: 60 },
  { id: "b60", date: "2026-01-25", description: "CITY PHARMACY", amount: -12.0, sourceRow: 61 },
  { id: "b61", date: "2026-01-12", description: "UBER", amount: -18.0, sourceRow: 62 },
  { id: "b62", date: "2026-01-22", description: "UTILITY PAYMENT", amount: -83.0, sourceRow: 63 },

  // ── Ambiguous / unknown (honest answer is unknown) ──
  { id: "b63", date: "2026-01-26", description: "AMAZON.COM", amount: -33.0, sourceRow: 64 },
  { id: "b64", date: "2026-02-26", description: "AMZN MKT US", amount: -41.0, sourceRow: 65 },
  { id: "b65", date: "2026-01-07", description: "PAYPAL", amount: -120.0, sourceRow: 66 },
  { id: "b66", date: "2026-01-29", description: "ONLINE SUBSCRIPTION", amount: -9.99, sourceRow: 67 },
  { id: "b67", date: "2026-01-30", description: "PRO DIGITAL SERVICE", amount: -4.99, sourceRow: 68 },
  { id: "b68", date: "2026-01-31", description: "XYZ CORP UNKNOWN SERVICE", amount: -6.0, sourceRow: 69 },

  // ── Data noise ──
  // Refund of a software charge: the refund line becomes its own merchant
  // (documented limitation), so it must not dilute the Adobe recurring signal.
  { id: "b69", date: "2026-02-06", description: "REFUND ADOBE", amount: +59.99, sourceRow: 70 },
  // Duplicate-looking separated charges for the same vendor in one month.
  { id: "b70", date: "2026-01-11", description: "SLACK", amount: -8.0, sourceRow: 71 },
  // Trailing store/locator number must not create a second merchant.
  { id: "b71", date: "2026-02-04", description: "ADOBE #9901", amount: -60.0, sourceRow: 72 },
  // "AMAZON WEB SERVICES" normalizes to the Amazon merchant identity (mixed ->
  // unknown) even though AWS bills through the same parent. Hard case.
  { id: "b72", date: "2026-01-20", description: "AMAZON WEB SERVICES", amount: -92.3, sourceRow: 73 },
];

// Ground-truth keys.
export const BENCHMARK_SOFTWARE_EXPECTED: string[] = [
  "adobe", "slack", "figma", "microsoft", "netflix", "spotify", "zoom",
  "openai", "shopify", "trello", "atlassian", "salesforce", "hubspot",
  "dropbox", "canva", "github", "notion", "aws",
];

export const BENCHMARK_NON_SOFTWARE_EXPECTED: string[] = [
  "grocery store", "fred s restaurant", "shell fuel", "city pharmacy",
  "uber", "utility payment",
];

export const BENCHMARK_AMBIGUOUS_KEYS: string[] = [
  "amazon", "paypal", "online subscription", "pro digital service",
  "xyz corp unknown service",
];

// Keys excluded from precision/recall because "unknown" is the correct honest
// answer for them (they are ambiguous by design).
export const BENCHMARK_HARD_KEYS: string[] = [
  // Amazon is mixed (marketplace + AWS + retail), so a generic Amazon charge
  // must stay unknown; only an explicit AWS line classifies as software.
  "amazon",
  // Refund lines normalize to their own merchant identity by design.
  "refund adobe",
];