import { describe, expect, it } from "vitest";
import type {
  ClassifiedMerchant,
  MerchantClassification,
} from "../classification";
import type {
  NormalizedTransactionWithMerchant,
  MerchantIdentity,
} from "../merchant/types";
import type { RecurringPattern, RecurringStatus } from "../recurring/types";
import { normalizeMerchants } from "../merchant";
import { classifyMerchants } from "../classification";
import { detectRecurring } from "../recurring";
import { aggregateSoftwareSpend } from "./aggregate";
import { medianAmount } from "./amounts";

// ---------- fixtures ----------

function identity(canonicalName: string, normalizedKey: string): MerchantIdentity {
  return {
    canonicalName,
    normalizedKey,
    source: "dictionary",
    confidence: "high",
    rawDescription: canonicalName,
    cleanedDescription: canonicalName.toUpperCase(),
  };
}

function tx(
  id: string,
  normalizedKey: string,
  canonicalName: string,
  date: string,
  amount: number,
): NormalizedTransactionWithMerchant {
  return {
    id,
    date,
    description: canonicalName,
    amount,
    sourceRow: 0,
    merchant: identity(canonicalName, normalizedKey),
  };
}

function classified(
  normalizedKey: string,
  category: "likely_saas" | "likely_software" | "not_software" | "unknown",
): ClassifiedMerchant {
  const classification: MerchantClassification = {
    category,
    confidence: "high",
    evidence: [{ type: "merchant_dictionary", message: "fixture" }],
  };
  return {
    normalizedKey,
    canonicalName: normalizedKey,
    transactionCount: 0,
    distinctRawDescriptions: [],
    classification,
  };
}

function recurring(
  status: RecurringStatus,
  interval: RecurringPattern["interval"],
  typicalAmount: number | null = 100,
): RecurringPattern {
  return {
    status,
    confidence: status === "likely_recurring" ? "high" : "medium",
    interval,
    evidence: [],
    transactionCount: 4,
    firstSeen: "2026-01-01",
    lastSeen: "2026-04-01",
    typicalAmount,
    strength: status === "likely_recurring" ? "moderate" : status === "insufficient_data" ? "insufficient" : "weak",
    amountProfile: "highly_stable",
    intervalConsistency: 1,
    patternSpanMonths: 3,
    gapCount: 0,
    priceChange: null,
  };
}

function spend(
  rows: NormalizedTransactionWithMerchant[],
  classifiedList: ClassifiedMerchant[],
  recurs: Array<[string, RecurringPattern]> = [],
) {
  const recurrences = new Map<string, RecurringPattern>(recurs);
  return aggregateSoftwareSpend(rows, classifiedList, recurrences);
}

// Full deterministic pipeline for integration tests.
function pipeline(rows: NormalizedTransactionWithMerchant[]) {
  const merchantResult = normalizeMerchants(rows);
  const classified = classifyMerchants(merchantResult.merchants).merchants;
  const recurring = detectRecurring(merchantResult.transactions);
  return aggregateSoftwareSpend(merchantResult.transactions, classified, recurring.patterns);
}

function byName<T extends { displayName: string }>(merchants: T[], name: string): T | undefined {
  return merchants.find((m) => m.displayName === name);
}

// ---------- tests ----------

describe("Step 9 software spend aggregation", () => {
  describe("basic aggregation", () => {
    it("computes total spend for a single software merchant", () => {
      const res = spend(
        [tx("1", "adobe", "Adobe", "2026-01-05", -1000), tx("2", "adobe", "Adobe", "2026-02-05", -1000)],
        [classified("adobe", "likely_saas")],
      );
      const adobe = byName(res.merchants, "adobe");
      expect(adobe?.status).toBe("software");
      expect(adobe?.totalSpend).toBe(2000);
      expect(adobe?.transactionCount).toBe(2);
      expect(res.summary.softwareMerchantCount).toBe(1);
      expect(res.summary.totalSoftwareSpend).toBe(2000);
    });

    it("aggregates multiple software merchants and isolates them", () => {
      const res = spend(
        [
          tx("1", "adobe", "Adobe", "2026-01-05", -1000),
          tx("2", "slack", "Slack", "2026-01-06", -500),
          tx("3", "adobe", "Adobe", "2026-02-05", -1000),
        ],
        [classified("adobe", "likely_saas"), classified("slack", "likely_saas")],
      );
      const adobe = byName(res.merchants, "adobe");
      const slack = byName(res.merchants, "slack");
      expect(adobe?.totalSpend).toBe(2000);
      expect(slack?.totalSpend).toBe(500);
      expect(res.summary.totalSoftwareSpend).toBe(2500);
      expect(res.summary.softwareMerchantCount).toBe(2);
    });
  });

  describe("recurring integration", () => {
    it("monthly recurring: monthly = typical, yearly = typical * 12", () => {
      const res = spend(
        [tx("1", "adobe", "Adobe", "2026-01-05", -999)],
        [classified("adobe", "likely_saas")],
        [["adobe", recurring("likely_recurring", "monthly", 999)]],
      );
      const adobe = byName(res.merchants, "adobe");
      expect(adobe?.estimatedMonthlySpend).toBe(999);
      expect(adobe?.estimatedYearlySpend).toBe(999 * 12);
      expect(res.summary.estimatedMonthlySpend).toBe(999);
      expect(res.summary.recurringSoftwareMerchantCount).toBe(1);
    });

    it("non-recurring software has no invented monthly cost", () => {
      const res = spend(
        [tx("1", "figma", "Figma", "2026-01-05", -4500)],
        [classified("figma", "likely_saas")],
        [["figma", recurring("not_recurring", "irregular")]],
      );
      const figma = byName(res.merchants, "figma");
      expect(figma?.status).toBe("software");
      expect(figma?.totalSpend).toBe(4500);
      expect(figma?.estimatedMonthlySpend).toBeNull();
      expect(figma?.estimatedYearlySpend).toBeNull();
    });

    it("insufficient_data gives no estimate but still counts as software", () => {
      const res = spend(
        [tx("1", "figma", "Figma", "2026-01-05", -4500)],
        [classified("figma", "likely_saas")],
        [["figma", recurring("insufficient_data", null)]],
      );
      const figma = byName(res.merchants, "figma");
      expect(figma?.estimatedMonthlySpend).toBeNull();
      expect(res.summary.softwareMerchantCount).toBe(1);
    });
  });

  describe("transaction handling", () => {
    it("excludes refunds (positive amounts) entirely", () => {
      const res = spend(
        [tx("1", "adobe", "Adobe", "2026-01-05", -1000), tx("2", "adobe", "Adobe", "2026-01-10", 1000), tx("3", "adobe", "Adobe", "2026-02-05", -1000)],
        [classified("adobe", "likely_saas")],
      );
      const adobe = byName(res.merchants, "adobe");
      expect(adobe?.totalSpend).toBe(2000);
      expect(adobe?.transactionCount).toBe(2);
    });

    it("excludes zero-value transactions", () => {
      const res = spend(
        [tx("1", "adobe", "Adobe", "2026-01-05", -1000), tx("2", "adobe", "Adobe", "2026-02-05", 0), tx("3", "adobe", "Adobe", "2026-03-05", -1000)],
        [classified("adobe", "likely_saas")],
      );
      const adobe = byName(res.merchants, "adobe");
      expect(adobe?.totalSpend).toBe(2000);
      expect(adobe?.transactionCount).toBe(2);
    });

    it("dedupes exact date|amount like the recurring layer", () => {
      const res = spend(
        [tx("1", "adobe", "Adobe", "2026-01-05", -1000), tx("2", "adobe", "Adobe", "2026-02-05", -1000), tx("3", "adobe", "Adobe", "2026-03-05", -1000), tx("4", "adobe", "Adobe", "2026-03-05", -1000)],
        [classified("adobe", "likely_saas")],
      );
      const adobe = byName(res.merchants, "adobe");
      expect(adobe?.transactionCount).toBe(3);
      expect(adobe?.totalSpend).toBe(3000);
    });

    it("keeps distinct dates+amounts as separate spend", () => {
      const res = spend(
        [tx("1", "adobe", "Adobe", "2026-01-05", -1000), tx("2", "adobe", "Adobe", "2026-01-05", -500)],
        [classified("adobe", "likely_saas")],
      );
      expect(byName(res.merchants, "adobe")?.totalSpend).toBe(1500);
    });

    it("does not mutate the source transactions", () => {
      const rows = [tx("1", "adobe", "Adobe", "2026-01-05", -1000), tx("2", "adobe", "Adobe", "2026-02-05", -1000)];
      const snapshot = JSON.stringify(rows);
      spend(rows, [classified("adobe", "likely_saas")]);
      expect(JSON.stringify(rows)).toBe(snapshot);
    });
  });

  describe("classification integration", () => {
    it("excludes non-software merchants from software spend", () => {
      const res = spend([tx("1", "market", "Market", "2026-01-05", -2000)], [classified("market", "not_software")]);
      expect(byName(res.merchants, "market")?.status).toBe("non_software");
      expect(res.summary.softwareMerchantCount).toBe(0);
      expect(res.summary.totalSoftwareSpend).toBe(0);
    });

    it("handles unknown classification as uncertain, excluded from software spend", () => {
      const res = spend([tx("1", "local", "Local", "2026-01-05", -500)], [classified("local", "unknown")]);
      const local = byName(res.merchants, "local");
      expect(local?.status).toBe("uncertain");
      expect(res.summary.softwareMerchantCount).toBe(0);
      expect(res.summary.uncertainMerchantCount).toBe(1);
    });

    it("recurring non-software must not become software", () => {
      const res = spend(
        [tx("1", "landlord", "Landlord", "2026-01-01", -20000)],
        [classified("landlord", "not_software")],
        [["landlord", recurring("likely_recurring", "monthly", 20000)]],
      );
      const landlord = byName(res.merchants, "landlord");
      expect(landlord?.status).toBe("non_software");
      expect(res.summary.softwareMerchantCount).toBe(0);
      expect(res.summary.estimatedMonthlySpend).toBe(0);
    });

    it("software merchant must not automatically become recurring", () => {
      const res = spend(
        [tx("1", "figma", "Figma", "2026-01-05", -4500)],
        [classified("figma", "likely_saas")],
        [["figma", recurring("insufficient_data", null)]],
      );
      const figma = byName(res.merchants, "figma");
      expect(figma?.status).toBe("software");
      expect(figma?.estimatedMonthlySpend).toBeNull();
    });
  });

  describe("estimates (median fallback)", () => {
    it("falls back to median of payment amounts when no typicalAmount", () => {
      const res = spend(
        [tx("1", "adobe", "Adobe", "2026-01-05", -80), tx("2", "adobe", "Adobe", "2026-02-05", -120)],
        [classified("adobe", "likely_saas")],
        [["adobe", recurring("likely_recurring", "monthly", null)]],
      );
      const adobe = byName(res.merchants, "adobe");
      expect(medianAmount([80, 120])).toBe(100);
      expect(adobe?.typicalTransactionAmount).toBe(100);
      expect(adobe?.estimatedMonthlySpend).toBe(100);
    });

    it("uses recurring typicalAmount when present over the median", () => {
      const res = spend(
        [tx("1", "adobe", "Adobe", "2026-01-05", -80), tx("2", "adobe", "Adobe", "2026-02-05", -120)],
        [classified("adobe", "likely_saas")],
        [["adobe", recurring("likely_recurring", "monthly", 250)]],
      );
      expect(byName(res.merchants, "adobe")?.estimatedMonthlySpend).toBe(250);
    });
  });

  describe("summary", () => {
    it("counts recurring vs non-recurring software merchants", () => {
      const res = spend(
        [
          tx("1", "adobe", "Adobe", "2026-01-05", -1000),
          tx("2", "figma", "Figma", "2026-01-05", -4500),
        ],
        [classified("adobe", "likely_saas"), classified("figma", "likely_saas")],
        [
          ["adobe", recurring("likely_recurring", "monthly", 1000)],
          ["figma", recurring("not_recurring", "irregular")],
        ],
      );
      expect(res.summary.softwareMerchantCount).toBe(2);
      expect(res.summary.recurringSoftwareMerchantCount).toBe(1);
      expect(res.summary.nonRecurringSoftwareMerchantCount).toBe(1);
      expect(res.summary.estimatedMonthlySpend).toBe(1000);
    });

    it("ranks top merchants by total and by monthly", () => {
      const res = spend(
        [
          tx("1", "big", "Big", "2026-01-05", -10000),
          tx("2", "small", "Small", "2026-01-05", -100),
        ],
        [classified("big", "likely_saas"), classified("small", "likely_saas")],
        [
          ["big", recurring("likely_recurring", "monthly", 500)],
          ["small", recurring("likely_recurring", "monthly", 50)],
        ],
      );
      expect(res.summary.topSoftwareByTotal[0].normalizedKey).toBe("big");
      expect(res.summary.topRecurringByMonthly[0].normalizedKey).toBe("big");
    });

    it("topRecurringByMonthly excludes merchants with no estimate", () => {
      const res = spend(
        [tx("1", "figma", "Figma", "2026-01-05", -4500)],
        [classified("figma", "likely_saas")],
        [["figma", recurring("not_recurring", "irregular")]],
      );
      expect(res.summary.topRecurringByMonthly).toHaveLength(0);
      expect(res.summary.topSoftwareByTotal.map((m) => m.normalizedKey)).toEqual(["figma"]);
    });
  });

  describe("edge cases", () => {
    it("empty dataset", () => {
      const res = spend([], []);
      expect(res.merchants).toHaveLength(0);
      expect(res.summary.totalSoftwareSpend).toBe(0);
      expect(res.summary.softwareMerchantCount).toBe(0);
    });

    it("one transaction", () => {
      const res = spend([tx("1", "adobe", "Adobe", "2026-01-05", -500)], [classified("adobe", "likely_saas")]);
      const adobe = byName(res.merchants, "adobe");
      expect(adobe?.totalSpend).toBe(500);
      expect(adobe?.estimatedMonthlySpend).toBeNull();
    });

    it("handles very large amounts without overflow", () => {
      const res = spend([tx("1", "adobe", "Adobe", "2026-01-05", -1000000000)], [classified("adobe", "likely_saas")]);
      expect(res.summary.totalSoftwareSpend).toBe(1000000000);
    });

    it("produces deterministic output", () => {
      const rows = [tx("1", "adobe", "Adobe", "2026-01-05", -100), tx("2", "adobe", "Adobe", "2026-02-05", -100)];
      expect(spend(rows, [classified("adobe", "likely_saas")])).toEqual(
        spend(rows, [classified("adobe", "likely_saas")]),
      );
    });
  });

  describe("pipeline (real normalize+classify+recurring)", () => {
    it("classifies a dictionary software merchant and estimates monthly", () => {
      const res = pipeline([
        tx("1", "adobe", "Adobe", "2026-01-05", -999),
        tx("2", "adobe", "Adobe", "2026-02-05", -999),
        tx("3", "adobe", "Adobe", "2026-03-05", -999),
        tx("4", "adobe", "Adobe", "2026-04-05", -999),
      ]);
      const adobe = byName(res.merchants, "Adobe");
      expect(adobe?.status).toBe("software");
      expect(adobe?.recurring?.interval).toBe("monthly");
      expect(adobe?.estimatedMonthlySpend).toBe(999);
    });

    it("non-software merchant is excluded even when recurring", () => {
      const res = pipeline([
        tx("1", "groc", "Grocery Store", "2026-01-05", -2000),
        tx("2", "groc", "Grocery Store", "2026-02-05", -2000),
        tx("3", "groc", "Grocery Store", "2026-03-05", -2000),
        tx("4", "groc", "Grocery Store", "2026-04-05", -2000),
      ]);
      const grocery = byName(res.merchants, "Grocery Store");
      expect(grocery?.status).toBe("non_software");
      expect(res.summary.softwareMerchantCount).toBe(0);
    });

    it("unresolved/generic merchant is uncertain, not software", () => {
      const res = pipeline([tx("1", "steam", "Steam", "2026-01-05", -4500)]);
      const steam = byName(res.merchants, "Steam");
      expect(steam?.status).toBe("uncertain");
      expect(res.summary.softwareMerchantCount).toBe(0);
    });
  });

  describe("performance", () => {
    it("handles a large dataset in linear time", () => {
      const rows: NormalizedTransactionWithMerchant[] = [];
      const classifiedList: ClassifiedMerchant[] = [];
      const recurs: Array<[string, RecurringPattern]> = [];
      const ms = 30 * 86400000;
      const start = Date.parse("2026-01-01");
      for (let m = 0; m < 2000; m++) {
        const key = `k${m}`;
        classifiedList.push(classified(key, "likely_saas"));
        recurs.push([key, recurring("likely_recurring", "monthly", 100)]);
        for (let mo = 0; mo < 12; mo++) {
          const date = new Date(start + mo * ms).toISOString().slice(0, 10);
          rows.push(tx(`${m}_${mo}`, key, key, date, -100));
        }
      }
      const begin = Date.now();
      const res = spend(rows, classifiedList, recurs);
      expect(Date.now() - begin).toBeLessThan(2000);
      expect(res.merchants.length).toBe(2000);
      expect(res.summary.softwareMerchantCount).toBe(2000);
    });
  });
});
