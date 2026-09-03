export type MerchantCategory =
  | "likely_saas"
  | "likely_software"
  | "not_software"
  | "unknown";

export type ClassificationConfidence = "high" | "medium" | "low";

export type ClassificationEvidenceType =
  | "merchant_dictionary"
  | "merchant_pattern"
  | "transaction_description"
  | "ambiguous_signal"
  | "generic_merchant";

export type ClassificationEvidence = {
  type: ClassificationEvidenceType;
  message: string;
};

export type MerchantClassification = {
  category: MerchantCategory;
  confidence: ClassificationConfidence;
  evidence: ClassificationEvidence[];
};

// Merchant-level counts based on merchant identities, not transactions.
// Must never mix identity counts with transaction counts.
export type ClassificationSummary = {
  likelySaasCount: number;
  likelySoftwareCount: number;
  notSoftwareCount: number;
  unknownCount: number;
  totalClassified: number;
  needsReview: number;
};
