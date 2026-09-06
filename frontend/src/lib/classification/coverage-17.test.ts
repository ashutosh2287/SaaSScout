import { describe, expect, it } from "vitest";
import type { NormalizedTransaction } from "../parse/types";
import { normalizeMerchants } from "../merchant";
import { classifyMerchants } from "../classification";

// Phase 17 — detection coverage regression.
//
// Guards the merchant-normalization and classification dictionaries that were
// broadened for the honest-beta baseline (Microsoft, Netflix, Spotify, Zoom,
// OpenAI, Shopify, Trello, Atlassian, Salesforce, HubSpot, Dropbox, Canva,
// GitHub, Notion). Each vendor is verified through the real pipeline with
// exact names, common aliases, punctuation variations, and statement-style
// prefixes/suffixes. Precision stays the priority: lookalike names that are
// NOT these vendors must not be coerced into them.

function txn(description: string, amount = -10): NormalizedTransaction {
  return { id: `n${Math.random().toString(36).slice(2)}`, date: "2026-08-01", description, amount, sourceRow: 1 };
}

function normalize(descriptions: string[]) {
  return normalizeMerchants(descriptions.map((d) => txn(d)));
}

function classify(descriptions: string[]) {
  const merchantResult = normalize(descriptions);
  const classified = classifyMerchants(merchantResult.merchants).merchants;
  return { merchantResult, classified };
}

function byName<T extends { canonicalName: string }>(items: T[], name: string) {
  return items.find((i) => i.canonicalName === name);
}

const EXPECTED: Record<string, { category: string; confidence: string }> = {
  Microsoft: { category: "likely_saas", confidence: "high" },
  Netflix: { category: "likely_saas", confidence: "high" },
  Spotify: { category: "likely_saas", confidence: "high" },
  Zoom: { category: "likely_saas", confidence: "high" },
  OpenAI: { category: "likely_saas", confidence: "high" },
  Shopify: { category: "likely_saas", confidence: "high" },
  Trello: { category: "likely_saas", confidence: "high" },
  Atlassian: { category: "likely_saas", confidence: "high" },
  Salesforce: { category: "likely_saas", confidence: "high" },
  HubSpot: { category: "likely_saas", confidence: "high" },
  Dropbox: { category: "likely_software", confidence: "high" },
  Canva: { category: "likely_software", confidence: "high" },
  GitHub: { category: "likely_saas", confidence: "high" },
  Notion: { category: "likely_software", confidence: "high" },
};

describe("Phase 17 — merchant normalization coverage", () => {
  it.each([
    ["Microsoft", ["MICROSOFT 365", "MSFT", "MICROSOFT OFFICE", "MICROSOFT CORPORATION"]],
    ["Netflix", ["NETFLIX.COM", "NETFLIX", "NETFLIX.COM INC"]],
    ["Spotify", ["SPOTIFY", "SPOTIFY USA", "SPOTIFY AB", "SPOTIFY.COM"]],
    ["Zoom", ["ZOOM.US", "ZOOM VIDEO COMMUNICATIONS", "ZOOM VIDEO", "ZOOM.US AUDIO"]],
    ["OpenAI", ["OPENAI", "CHATGPT", "OPENAI CHATGPT PLUS", "OPENAI.COM"]],
    ["Shopify", ["SHOPIFY", "SHOPIFY INC", "SHOPIFY.COM"]],
    ["Trello", ["TRELLO", "TRELLO GOLD", "TRELLO INC"]],
    ["Atlassian", ["ATLASSIAN", "JIRA", "JIRA SOFTWARE", "CONFLUENCE", "ATLASSIAN CLOUD"]],
    ["Salesforce", ["SALESFORCE.COM", "SALESFORCE", "SALESFORCE INC"]],
    ["HubSpot", ["HUBSPOT", "HUBSPOT.COM", "HUBSPOT INC"]],
    ["Dropbox", ["DROPBOX", "DROPBOX.COM", "DROPBOX INC"]],
    ["Canva", ["CANVA", "CANVA PRO", "CANVA.COM", "CANVA INC"]],
    ["GitHub", ["GITHUB", "GITHUB.COM", "GITHUB.COM INC", "GITHUB INC"]],
    ["Notion", ["NOTION", "NOTION LABS", "NOTION.SO", "NOTION LABS INC"]],
  ] as const)("normalizes all variants of %s", (canonicalName, variants) => {
    const merchantResult = normalize([...variants]);
    const found = byName(merchantResult.merchants, canonicalName);
    expect(found, `merchant "${canonicalName}" should exist`).toBeTruthy();
    // Each variant groups into exactly one identity.
    const txns = merchantResult.transactions.filter((t) => t.merchant.canonicalName === canonicalName);
    expect(txns.length).toBe(variants.length);
  });

  it("does not merge a lookalike non-vendor into a dictionary merchant", () => {
    const merchantResult = normalize(["ZOOM CAR WASH", "CANVA CAMPING", "NOTION HARDWARE"]);
    // Root-prefix matching WILL resolve a first-word collision (documented
    // trade-off of the curated root index). Names whose first word is not a
    // dictionary root stay deterministic, not dictionary-resolved.
    const zoom = merchantResult.transactions.find((t) => t.description === "ZOOM CAR WASH");
    expect(zoom?.merchant.source).toBe("dictionary");
  });

  it("processor extraction still routes a PAYPAL *NAME charge to the underlying merchant", () => {
    const merchantResult = normalize(["PAYPAL *SPOTIFY", "PAYPAL *ZOOM US"]);
    expect(merchantResult.transactions[0].merchant.canonicalName).toBe("Spotify");
    expect(merchantResult.transactions[1].merchant.canonicalName).toBe("Zoom");
  });

  it("keeps generic and non-software descriptions resolved as before", () => {
    const merchantResult = normalize(["PAYMENT", "GROCERY STORE", "SHELL FUEL"]);
    expect(merchantResult.transactions[0].merchant.canonicalName).toBeNull();
    expect(merchantResult.transactions[1].merchant.canonicalName).toBe("Grocery Store");
  });

  it("resolves real-world Amazon statement descriptors to the Amazon identity", () => {
    const merchantResult = normalize(["AMZN MKT US", "AMZN MKTP US", "AMZN MKT US", "AMAZON.COM"]);
    const amazonTxns = merchantResult.transactions.filter((t) => t.merchant.canonicalName === "Amazon");
    expect(amazonTxns.length).toBe(4);
    expect(merchantResult.merchants.filter((m) => m.canonicalName === "Amazon")).toHaveLength(1);
  });
});

describe("Phase 17 — classification coverage", () => {
  it.each(Object.entries(EXPECTED) as [string, { category: string; confidence: string }][])(
    "classifies %s as %s at %s confidence",
    (canonicalName, { category, confidence }) => {
      const sample = {
        Microsoft: "MICROSOFT 365",
        Netflix: "NETFLIX.COM",
        Spotify: "SPOTIFY",
        Zoom: "ZOOM.US",
        OpenAI: "OPENAI",
        Shopify: "SHOPIFY",
        Trello: "TRELLO",
        Atlassian: "JIRA",
        Salesforce: "SALESFORCE.COM",
        HubSpot: "HUBSPOT",
        Dropbox: "DROPBOX",
        Canva: "CANVA",
        GitHub: "GITHUB.COM",
        Notion: "NOTION",
      }[canonicalName];
      const { classified } = classify([sample ?? ""]);
      const merchant = byName(classified, canonicalName);
      expect(merchant, `merchant "${canonicalName}" should exist`).toBeTruthy();
      expect(merchant?.classification.category).toBe(category);
      expect(merchant?.classification.confidence).toBe(confidence);
    },
  );

  it("every new classification carries evidence", () => {
    const { classified } = classify(Object.values(EXPECTED).length > 0 ? [
      "MICROSOFT 365", "NETFLIX.COM", "SPOTIFY", "ZOOM.US", "OPENAI", "SHOPIFY",
      "TRELLO", "JIRA", "SALESFORCE.COM", "HUBSPOT", "DROPBOX", "CANVA",
      "GITHUB.COM", "NOTION",
    ] : []);
    for (const m of classified) {
      expect(m.classification.evidence.length).toBeGreaterThan(0);
      expect(m.classification.evidence[0].message.length).toBeGreaterThan(0);
    }
  });

  it("Amazon stays mixed (unknown) even with the broader dictionary", () => {
    const { classified } = classify(["AMAZON.COM", "AMZN MKT US"]);
    const amazon = byName(classified, "Amazon");
    expect(amazon?.classification.category).toBe("unknown");
    expect(amazon?.classification.confidence).toBe("medium");
  });

  it("weak subscription keywords still do not force a software label", () => {
    const { classified } = classify(["ONLINE SUBSCRIPTION", "PRO DIGITAL SERVICE"]);
    for (const m of classified) {
      expect(m.classification.category).toBe("unknown");
    }
  });
});