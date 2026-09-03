import type {
  ClassificationConfidence,
  MerchantCategory,
} from "./types";

// Non-software transaction categories. Matched as a whole normalizedKey OR as
// word-in-description. Wide terms (SERVICE, ONLINE) are deliberately excluded —
// they are weak signals that must not cause software classifications.
export const NON_SOFTWARE_CATEGORIES = new Set([
  "grocery",
  "restaurant",
  "cafe",
  "coffee",
  "supermarket",
  "utility",
  "electric",
  "electricity",
  "water",
  "gas",
  "insurance",
  "rent",
  "hotel",
  "airline",
  "airlines",
  "flight",
  "taxi",
  "uber",
  "lyft",
  "transport",
  "transportation",
  "pharmacy",
  "fuel",
]);

// Curated single-word software product signals found in descriptions. These
// are highly specific product names — never generic words like PRO, CLOUD,
// ONLINE, DIGITAL, SERVICE, SUBSCRIPTION. Only used as supporting evidence at
// the merchant level, never alone to force a SaaS classification.
export type SoftwareSignal = {
  signal: string;
  category: MerchantCategory;
  confidence: ClassificationConfidence;
  evidence: string;
};

export const SOFTWARE_DESCRIPTION_SIGNALS: SoftwareSignal[] = [
  {
    signal: "creative cloud",
    category: "likely_software",
    confidence: "medium",
    evidence: "Transaction description matches a recognized software product.",
  },
  {
    signal: "microsoft 365",
    category: "likely_saas",
    confidence: "medium",
    evidence: "Transaction description matches a recognized software-as-a-service product.",
  },
  {
    signal: "office 365",
    category: "likely_saas",
    confidence: "medium",
    evidence: "Transaction description matches a recognized software-as-a-service product.",
  },
  {
    signal: "google workspace",
    category: "likely_saas",
    confidence: "medium",
    evidence: "Transaction description matches a recognized software-as-a-service product.",
  },
  {
    signal: "github",
    category: "likely_saas",
    confidence: "medium",
    evidence: "Transaction description matches a recognized software-as-a-service product.",
  },
  {
    signal: "notion",
    category: "likely_software",
    confidence: "medium",
    evidence: "Transaction description matches a recognized software product.",
  },
  {
    signal: "canva",
    category: "likely_software",
    confidence: "medium",
    evidence: "Transaction description matches a recognized software product.",
  },
  {
    signal: "dropbox",
    category: "likely_software",
    confidence: "medium",
    evidence: "Transaction description matches a recognized software product.",
  },
  {
    signal: "aws",
    category: "likely_software",
    confidence: "medium",
    evidence: "Transaction description identifies a software/cloud service.",
  },
];

// Mixed merchants whose identity spans software and non-software spend
// (e.g. Amazon = shopping + AWS + Prime + marketplace). Never auto-classified.
export const MIXED_MERCHANTS = new Set(["amazon", "amzn"]);

// Payment processors. Without a safely extracted underlying merchant these
// remain unknown rather than "likely_saas".
export const PAYMENT_PROCESSORS = new Set([
  "paypal",
  "stripe",
  "square",
  "adyen",
  "worldpay",
]);
