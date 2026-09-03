import type { MerchantDefinition } from "./types";

// A small curated identity/alias dictionary used only for merchant
// normalization (which descriptions refer to the same business).
// It is NOT a SaaS/software classification database.
//
// `root` is a leading whole-word token that, when present as the first word,
// resolves the description to the canonical name (prefix match). Aliases are
// exact-match keys. Both are matched after conservative cleaning.
// Add entries here as the product matures; keep the set explicit.
export const MERCHANT_DICTIONARY: MerchantDefinition[] = [
  {
    canonicalName: "Adobe",
    root: "adobe",
    aliases: ["adobe", "adobe inc", "adobe.com", "adobe creative cloud", "adobe cc", "adobe systems"],
  },
  {
    canonicalName: "Slack",
    root: "slack",
    aliases: ["slack", "slack technologies", "slack technologies inc"],
  },
  {
    canonicalName: "Amazon",
    root: "amazon",
    aliases: ["amazon", "amazon.com", "amazon marketplace", "amzn", "amzn mktp", "amzn mktplace", "amzn.com", "amzn mktp us"],
  },
  {
    canonicalName: "Figma",
    root: "figma",
    aliases: ["figma"],
  },
  {
    canonicalName: "Netflix",
    root: "netflix",
    aliases: ["netflix", "netflix.com"],
  },
];

export const DICTIONARY_ROOT_WORDS: { [root: string]: string } = Object.fromEntries(
  MERCHANT_DICTIONARY.map((d) => [d.root, d.canonicalName]),
);