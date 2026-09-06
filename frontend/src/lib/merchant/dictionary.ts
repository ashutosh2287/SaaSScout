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
    aliases: [
      "amazon", "amazon.com", "amazon marketplace", "amzn", "amzn mktp", "amzn mktplace",
      "amzn.com", "amzn mktp us", "amzn mkt us", "amzn mkp us", "amzn mktpl us",
    ],
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
  {
    canonicalName: "Microsoft",
    root: "microsoft",
    aliases: ["microsoft", "microsoft 365", "microsoft office", "msft", "microsoft corp", "microsoft corporation", "microsoft inc", "microsoft store"],
  },
  {
    canonicalName: "Spotify",
    root: "spotify",
    aliases: ["spotify", "spotify ab", "spotify usa", "spotify.com"],
  },
  {
    canonicalName: "Zoom",
    root: "zoom",
    aliases: ["zoom", "zoom.us", "zoom us", "zoom video", "zoom video communications", "zoom video comms", "zoom.zoom"],
  },
  {
    canonicalName: "OpenAI",
    root: "openai",
    aliases: ["openai", "openai inc", "openai chatgpt", "chatgpt", "chatgpt plus", "openai.com"],
  },
  {
    canonicalName: "Shopify",
    root: "shopify",
    aliases: ["shopify", "shopify.com", "shopify inc", "shopify payments"],
  },
  {
    canonicalName: "Trello",
    root: "trello",
    aliases: ["trello", "trello gold", "trello inc"],
  },
  {
    canonicalName: "Atlassian",
    root: "atlassian",
    aliases: ["atlassian", "atlassian cloud", "atlassian inc", "jira", "jira software", "confluence", "confluence cloud"],
  },
  {
    canonicalName: "Salesforce",
    root: "salesforce",
    aliases: ["salesforce", "salesforce.com", "salesforce inc"],
  },
  {
    canonicalName: "HubSpot",
    root: "hubspot",
    aliases: ["hubspot", "hubspot inc", "hubspot.com"],
  },
  {
    canonicalName: "Dropbox",
    root: "dropbox",
    aliases: ["dropbox", "dropbox.com", "dropbox inc"],
  },
  {
    canonicalName: "Canva",
    root: "canva",
    aliases: ["canva", "canva inc", "canva pro", "canva.com"],
  },
  {
    canonicalName: "GitHub",
    root: "github",
    aliases: ["github", "github inc", "github.com", "github.com inc"],
  },
  {
    canonicalName: "Notion",
    root: "notion",
    aliases: ["notion", "notion labs", "notion labs inc", "notion.so"],
  },
];

export const DICTIONARY_ROOT_WORDS: { [root: string]: string } = Object.fromEntries(
  MERCHANT_DICTIONARY.map((d) => [d.root, d.canonicalName]),
);