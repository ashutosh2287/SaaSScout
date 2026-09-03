import { describe, expect, it } from "vitest";
import { normalizeMerchants } from "../merchant";
import { classifyMerchants, classifyMerchant } from "./classify";
import type { ClassifiedMerchant } from "./classify";
import type { MerchantSummary } from "../merchant/types";
import { CLASSIFICATION_FIXTURES } from "./__fixtures__/fixtures";

// Run the real pipeline: descriptions -> normalizeMerchants -> classifyMerchants.
function runPipeline(transactions = CLASSIFICATION_FIXTURES) {
  const merchantResult = normalizeMerchants(transactions);
  const classificationResult = classifyMerchants(merchantResult.merchants);
  return { merchantResult, classificationResult };
}

function byName(merchants: ClassifiedMerchant[], canonicalName: string) {
  return merchants.find((m) => m.canonicalName === canonicalName);
}

describe("Step 7 classification", () => {
  describe("known software merchants", () => {
    it("classifies Adobe as likely_software", () => {
      const { classificationResult } = runPipeline();
      const adobe = byName(classificationResult.merchants, "Adobe");
      expect(adobe?.classification.category).toBe("likely_software");
      expect(adobe?.classification.confidence).toBe("high");
    });

    it("classifies Slack as likely_saas", () => {
      const { classificationResult } = runPipeline();
      const slack = byName(classificationResult.merchants, "Slack");
      expect(slack?.classification.category).toBe("likely_saas");
      expect(slack?.classification.confidence).toBe("high");
    });

    it("classifies Figma as likely_saas", () => {
      const { classificationResult } = runPipeline();
      const figma = byName(classificationResult.merchants, "Figma");
      expect(figma?.classification.category).toBe("likely_saas");
      expect(figma?.classification.confidence).toBe("high");
    });
  });

  describe("known non-software", () => {
    it.each([
      ["Grocery Store", "GROCERY STORE"],
      ["Local Restaurant", "LOCAL RESTAURANT"],
      ["Utility Payment", "UTILITY PAYMENT"],
    ])("classifies %s as not_software", (name, description) => {
      const txn = {
        id: "x",
        date: "2026-08-01",
        description,
        amount: -10,
        sourceRow: 1,
      };
      const { classificationResult } = runPipeline([txn]);
      const m = byName(classificationResult.merchants, name);
      expect(m?.classification.category).toBe("not_software");
      expect(m?.classification.confidence).toBe("high");
    });
  });

  describe("unknown merchants", () => {
    it("returns unknown rather than guessing", () => {
      const txn = {
        id: "x",
        date: "2026-08-01",
        description: "ABC BUSINESS",
        amount: -10,
        sourceRow: 1,
      };
      const { classificationResult } = runPipeline([txn]);
      expect(classificationResult.merchants[0].classification.category).toBe("unknown");
      expect(classificationResult.merchants[0].classification.confidence).toBe("low");
    });
  });

  describe("payment processors", () => {
    it("keeps standalone PAYPAL unknown", () => {
      const { classificationResult } = runPipeline();
      const paypal = byName(classificationResult.merchants, "Paypal");
      expect(paypal?.classification.category).toBe("unknown");
      expect(paypal?.classification.confidence).toBe("medium");
    });

    it("classifies a safely extracted underlying merchant instead", () => {
      const { classificationResult } = runPipeline();
      const adobe = byName(classificationResult.merchants, "Adobe");
      expect(adobe?.classification.category).toBe("likely_software");
    });
  });

  describe("mixed merchants", () => {
    it("does not auto-classify Amazon as software", () => {
      const { classificationResult } = runPipeline();
      const amazon = byName(classificationResult.merchants, "Amazon");
      expect(amazon?.classification.category).toBe("unknown");
    });

    it("classifies an explicit AWS description as software", () => {
      const { classificationResult } = runPipeline();
      const aws = byName(classificationResult.merchants, "Aws");
      expect(aws?.classification.category).toBe("likely_software");
    });
  });

  describe("weak keywords", () => {
    it.each(["ONLINE SUBSCRIPTION", "PRO DIGITAL SERVICE"])(
      "does not classify '%s' as software",
      (description) => {
        const txn = {
          id: "x",
          date: "2026-08-01",
          description,
          amount: -10,
          sourceRow: 1,
        };
        const { classificationResult } = runPipeline([txn]);
        const c = classificationResult.merchants[0].classification;
        expect(c.category).toBe("unknown");
      },
    );
  });

  describe("evidence", () => {
    it("every non-unknown classification has meaningful evidence", () => {
      const { classificationResult } = runPipeline();
      for (const m of classificationResult.merchants) {
        if (m.classification.category !== "unknown") {
          expect(m.classification.evidence.length).toBeGreaterThan(0);
          expect(m.classification.evidence[0].message.length).toBeGreaterThan(0);
        }
      }
    });

    it("unknown results explain insufficient evidence without overclaiming", () => {
      const txn = {
        id: "x",
        date: "2026-08-01",
        description: "SOMETHING OPAQUE",
        amount: -10,
        sourceRow: 1,
      };
      const { classificationResult } = runPipeline([txn]);
      const evidence = classificationResult.merchants[0].classification.evidence;
      expect(evidence.length).toBeGreaterThan(0);
      expect(evidence[0].message.toLowerCase()).toContain("not enough evidence");
    });
  });

  describe("determinism", () => {
    it("produces identical output for identical input", () => {
      const a = runPipeline().classificationResult;
      const b = runPipeline().classificationResult;
      expect(a).toEqual(b);
    });
  });

  describe("group-level reuse", () => {
    it("reuses one classification across all transactions of a merchant", () => {
      // Adobe appears twice (ADOBE *CREATIVE CLOUD and PAYPAL *ADOBE) yet there
      // is exactly one Adobe merchant identity sharing one classification.
      const { merchantResult, classificationResult } = runPipeline();
      const adobeSummaries = classificationResult.merchants.filter(
        (m) => m.normalizedKey === "adobe",
      );
      expect(adobeSummaries).toHaveLength(1);

      const adobeTxns = merchantResult.transactions.filter(
        (t) => t.merchant.normalizedKey === "adobe",
      );
      expect(adobeTxns.length).toBe(2);
      expect(adobeTxns.every((t) => t.merchant.canonicalName === "Adobe")).toBe(true);
    });
  });

  describe("no mutation", () => {
    it("does not mutate the input merchant summaries", () => {
      const { merchantResult } = runPipeline();
      const snapshot = JSON.stringify(merchantResult.merchants);
      classifyMerchants(merchantResult.merchants);
      expect(JSON.stringify(merchantResult.merchants)).toBe(snapshot);
    });
  });

  describe("classification summary", () => {
    it("counts by merchant identity, not transactions", () => {
      const { classificationResult } = runPipeline();
      const s = classificationResult.summary;
      // 14 merchants: Adobe(likely_software) Slack, Figma(2 saas) = but Slack/Figma = 2 saas
      // grocery, restaurant, utility = 3 not_software
      // paypal(unknown) amazon(unknown) amazon+aws grouped=mixed(unknown) unknown business(unknown)
      // online sub(unknown) pro digital(unknown) aws(likely_software)
      expect(s.totalClassified).toBe(classificationResult.merchants.length);
      expect(s.likelySaasCount).toBe(2); // Slack, Figma
      expect(s.likelySoftwareCount).toBe(2); // Adobe, Aws
      expect(s.notSoftwareCount).toBe(3);
      expect(s.unknownCount).toBe(s.needsReview);
    });
  });
});

describe("classifyMerchant direct unit", () => {
  it("handles an unresolved merchant (null canonical) safely", () => {
    const unresolved: MerchantSummary = {
      normalizedKey: "cash",
      canonicalName: "Cash",
      transactionCount: 1,
      distinctRawDescriptions: ["CASH"],
    };
    const result = classifyMerchant(unresolved);
    expect(["unknown", "not_software"]).toContain(result.classification.category);
  });
});