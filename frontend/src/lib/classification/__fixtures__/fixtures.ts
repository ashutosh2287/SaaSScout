import type { NormalizedTransaction } from "../../parse/types";

// Synthetic only — never private financial data. Exercises the full merchant ->
// classification pipeline: normalizeMerchants then classifyMerchants.
export const CLASSIFICATION_FIXTURES: NormalizedTransaction[] = [
  { id: "t1", date: "2026-08-01", description: "ADOBE *CREATIVE CLOUD 800-833-6687", amount: -59.99, sourceRow: 2 },
  { id: "t2", date: "2026-08-05", description: "SLACK PRO", amount: -8.0, sourceRow: 3 },
  { id: "t3", date: "2026-08-06", description: "FIGMA", amount: -15.0, sourceRow: 4 },
  { id: "t4", date: "2026-08-07", description: "GROCERY STORE", amount: -45.5, sourceRow: 5 },
  { id: "t5", date: "2026-08-08", description: "LOCAL RESTAURANT", amount: -22.0, sourceRow: 6 },
  { id: "t6", date: "2026-08-09", description: "UTILITY PAYMENT", amount: -80.0, sourceRow: 7 },
  { id: "t7", date: "2026-08-10", description: "PAYPAL", amount: -120.0, sourceRow: 8 },
  { id: "t8", date: "2026-08-11", description: "PAYPAL *ADOBE", amount: -60.0, sourceRow: 9 },
  { id: "t9", date: "2026-08-12", description: "AMAZON", amount: -33.0, sourceRow: 10 },
  { id: "t10", date: "2026-08-13", description: "AWS", amount: -10.0, sourceRow: 11 },
  { id: "t11", date: "2026-08-14", description: "UNKNOWN BUSINESS", amount: -5.0, sourceRow: 12 },
  { id: "t12", date: "2026-08-15", description: "ONLINE SUBSCRIPTION", amount: -9.99, sourceRow: 13 },
  { id: "t13", date: "2026-08-16", description: "PRO DIGITAL SERVICE", amount: -4.99, sourceRow: 14 },
  { id: "t14", date: "2026-08-17", description: "AMAZON AWS", amount: -25.0, sourceRow: 15 },
];