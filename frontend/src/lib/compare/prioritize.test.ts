import { describe, expect, it } from "vitest";
import { prioritizeFindings } from "./prioritize";
import { suggestedAction } from "./format";
import type { ComparisonFinding } from "./types";

function finding(kind: ComparisonFinding["kind"], key: string, yearlyDelta: number | null, name?: string, confidence: ComparisonFinding["confidence"] = "high"): ComparisonFinding {
  return {
    kind,
    merchantKey: key,
    merchantName: name ?? key.toUpperCase(),
    confidence,
    evidence: [],
    impact: { monthlyDelta: null, yearlyDelta },
  };
}

describe("prioritizeFindings", () => {
  it("orders by |yearly delta| descending", () => {
    const out = prioritizeFindings([
      finding("price_increase", "openai", 1320),
      finding("new_recurring", "salesforce", 720),
      finding("ended_recurring", "atlassian", -960),
    ]);
    expect(out.map((f) => f.merchantKey)).toEqual(["openai", "atlassian", "salesforce"]);
  });

  it("sinks null-impact findings below priced ones, preserving deterministic order among them", () => {
    const out = prioritizeFindings([
      finding("merchant_appeared", "zzz", null),
      finding("price_increase", "openai", 1320),
      finding("merchant_disappeared", "aaa", null),
      finding("ended_recurring", "atlassian", -960),
    ]);
    expect(out.map((f) => f.merchantKey)).toEqual(["openai", "atlassian", "zzz", "aaa"]);
  });

  it("breaks ties by kind order (new->ended->price) then merchant name", () => {
    const out = prioritizeFindings([
      finding("ended_recurring", "zebra", 300),
      finding("new_recurring", "alpha", 300),
      finding("price_increase", "mid", 300),
    ]);
    expect(out.map((f) => f.merchantKey)).toEqual(["alpha", "zebra", "mid"]);
  });

  it("keeps empty input empty and does not mutate the input array", () => {
    const input = [finding("price_increase", "a", 10), finding("price_increase", "b", 100)];
    const copy = [...input];
    expect(prioritizeFindings([])).toEqual([]);
    prioritizeFindings(input);
    expect(input).toEqual(copy);
  });

  it("sorts non-finite and null deltas to the bottom deterministically", () => {
    const out = prioritizeFindings([
      finding("price_increase", "nan", NaN),
      finding("price_increase", "inf", Infinity),
      finding("merchant_appeared", "null-a", null),
      finding("price_increase", "top", 500),
    ]);
    expect(out.map((f) => f.merchantKey)).toEqual(["top", "inf", "nan", "null-a"]);
  });

  it("does not hide low-confidence findings from the top — confidence is shown, not filtered", () => {
    const out = prioritizeFindings([
      finding("merchant_appeared", "low", null),
      finding("price_increase", "biglow", 2000, "Big Low", "low"),
    ]);
    // The high-impact low-confidence finding ranks first; its badge still says
    // "Low confidence" and its evidence renders. Confidence informs, ordering serves impact.
    expect(out[0].merchantKey).toBe("biglow");
    expect(out[0].confidence).toBe("low");
  });

  it("scales to 1k/5k/10k/25k findings within a generous budget (O(n log n))", () => {
    for (const count of [1000, 5000, 10000, 25000]) {
      const input: ComparisonFinding[] = [];
      for (let i = 0; i < count; i++) {
        input.push(
          finding(
            i % 3 === 0 ? "price_increase" : i % 3 === 1 ? "new_recurring" : "ended_recurring",
            `m${i}`,
            i % 2 === 0 ? i : null,
            `Merchant ${i}`,
          ),
        );
      }
      const start = performance.now();
      const out = prioritizeFindings(input);
      const elapsed = performance.now() - start;
      expect(out.length).toBe(count);
      expect(out[0].merchantKey).toBe(`m${count - (count % 2 === 0 ? 2 : 1)}`);
      expect(elapsed).toBeLessThan(2000);
    }
  });
});

describe("suggestedAction", () => {
  it("never tells the user to cancel a subscription", () => {
    for (const kind of ["new_recurring", "ended_recurring", "price_increase", "price_decrease", "frequency_change", "pattern_irregular", "merchant_appeared", "merchant_disappeared"] as const) {
      const action = suggestedAction(finding(kind, "x", 1)) ?? "";
      expect(action).toBeTruthy();
      expect(action.toLowerCase()).not.toContain("cancel this subscription");
      expect(action.toLowerCase()).not.toContain("cancel the subscription");
    }
  });

  it("gives every finding kind a neutral next step", () => {
    const kinds = ["new_recurring", "ended_recurring", "price_increase", "price_decrease", "frequency_change", "pattern_irregular", "merchant_appeared", "merchant_disappeared"] as const;
    for (const kind of kinds) {
      expect(suggestedAction(finding(kind, "x", 1))).toMatch(/confirm|check|no action|review|likely/i);
    }
  });
});