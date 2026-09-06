import type {
  ClassificationConfidence,
  MerchantCategory,
} from "./types";

// Case 1: explicit software/SaaS vendors recognized by their merchant
// identity (normalizedKey from Step 6). Keep small and curated — the goal is
// to prove the architecture, not enumerate every vendor. We intentionally
// distinguish "likely_software" (any software provider) from "likely_saas"
// (services delivered as a subscription) and never manufacture certainty.
export type ClassificationDefinition = {
  normalizedKey: string;
  category: MerchantCategory;
  confidence: ClassificationConfidence;
  evidence: string;
};

export const CLASSIFICATION_DICTIONARY: ClassificationDefinition[] = [
  {
    normalizedKey: "aws",
    category: "likely_software",
    confidence: "high",
    evidence: "Merchant is recognized as a software provider.",
  },
  {
    normalizedKey: "adobe",
    category: "likely_software",
    confidence: "high",
    evidence: "Merchant is recognized as a software provider.",
  },
  {
    normalizedKey: "slack",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a software-as-a-service provider.",
  },
  {
    normalizedKey: "figma",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a software-as-a-service provider.",
  },
  {
    normalizedKey: "microsoft",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a software-as-a-service provider.",
  },
  {
    normalizedKey: "netflix",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a subscription service provider.",
  },
  {
    normalizedKey: "spotify",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a subscription service provider.",
  },
  {
    normalizedKey: "zoom",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a software-as-a-service provider.",
  },
  {
    normalizedKey: "openai",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a software-as-a-service provider.",
  },
  {
    normalizedKey: "shopify",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a software-as-a-service provider.",
  },
  {
    normalizedKey: "trello",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a software-as-a-service provider.",
  },
  {
    normalizedKey: "atlassian",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a software-as-a-service provider.",
  },
  {
    normalizedKey: "salesforce",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a software-as-a-service provider.",
  },
  {
    normalizedKey: "hubspot",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a software-as-a-service provider.",
  },
  {
    normalizedKey: "dropbox",
    category: "likely_software",
    confidence: "high",
    evidence: "Merchant is recognized as a software provider.",
  },
  {
    normalizedKey: "canva",
    category: "likely_software",
    confidence: "high",
    evidence: "Merchant is recognized as a software provider.",
  },
  {
    normalizedKey: "github",
    category: "likely_saas",
    confidence: "high",
    evidence: "Merchant is recognized as a software-as-a-service provider.",
  },
  {
    normalizedKey: "notion",
    category: "likely_software",
    confidence: "high",
    evidence: "Merchant is recognized as a software provider.",
  },
];

// O(1) lookup by Step 6 normalizedKey.
export const CLASSIFICATION_DICTIONARY_INDEX: Map<string, ClassificationDefinition> = new Map(
  CLASSIFICATION_DICTIONARY.map((d) => [d.normalizedKey, d]),
);
