import {
  HIGH_CONFIDENCE,
  LOW_CONFIDENCE,
  MEDIUM_CONFIDENCE,
} from "./constants";
import { CLASSIFICATION_DICTIONARY_INDEX } from "./dictionary";
import {
  MIXED_MERCHANTS,
  NON_SOFTWARE_CATEGORIES,
  PAYMENT_PROCESSORS,
  SOFTWARE_DESCRIPTION_SIGNALS,
} from "./signals";
import type {
  ClassificationEvidenceType,
  ClassificationSummary,
  MerchantCategory,
  MerchantClassification,
} from "./types";
import type { MerchantSummary } from "../merchant/types";

// A classified merchant is a MerchantSummary with a `classification` attached.
export type ClassifiedMerchant = MerchantSummary & {
  classification: MerchantClassification;
};

export type ClassifyResult = {
  merchants: ClassifiedMerchant[];
  summary: ClassificationSummary;
};

const EMPTY_SUMMARY: ClassificationSummary = {
  likelySaasCount: 0,
  likelySoftwareCount: 0,
  notSoftwareCount: 0,
  unknownCount: 0,
  totalClassified: 0,
  needsReview: 0,
};

export function classifyMerchant(summary: MerchantSummary): ClassifiedMerchant {
  return { ...summary, classification: classifyIdentity(summary) };
}

function evidence(type: ClassificationEvidenceType, message: string): MerchantClassification["evidence"] {
  return [{ type, message }];
}

// Deterministic, evidence-based classification. Precision over recall: every
// non-unknown result needs a concrete, explainable reason; weak evidence stays
// unknown rather than guessing.
function classifyIdentity(summary: MerchantSummary): MerchantClassification {
  const key = summary.normalizedKey ?? "";
  const canonical = summary.canonicalName?.toLowerCase() ?? "";
  const descriptions = summary.distinctRawDescriptions;

  const dict = CLASSIFICATION_DICTIONARY_INDEX.get(key);
  if (dict) {
    return {
      category: dict.category,
      confidence: dict.confidence,
      evidence: evidence("merchant_dictionary", dict.evidence),
    };
  }

  // Mixed merchants (Amazon) and payment processors both stay unknown: their
  // identity spans spend that can't confidently be called software.
  const ambiguous = MIXED_MERCHANTS.has(key) || PAYMENT_PROCESSORS.has(key);
  if (ambiguous) {
    const message = MIXED_MERCHANTS.has(key)
      ? "This merchant also handles non-software spend, so it can't be classified as software."
      : "This is a payment processor; the underlying merchant couldn't be identified.";
    return { category: "unknown", confidence: MEDIUM_CONFIDENCE, evidence: evidence("ambiguous_signal", message) };
  }

  if (matchesNonSoftwareCategory(key) || matchesNonSoftwareCategory(canonical)) {
    return {
      category: "not_software",
      confidence: HIGH_CONFIDENCE,
      evidence: evidence("merchant_pattern", "Merchant matches a known non-software category."),
    };
  }

  for (const signal of SOFTWARE_DESCRIPTION_SIGNALS) {
    if (descriptions.some((d) => d.toLowerCase().includes(signal.signal))) {
      return {
        category: signal.category,
        confidence: signal.confidence,
        evidence: evidence("transaction_description", signal.evidence),
      };
    }
  }

  return {
    category: "unknown",
    confidence: LOW_CONFIDENCE,
    evidence: evidence("generic_merchant", "Not enough evidence to classify this merchant as software."),
  };
}

export function classifyMerchants(merchants: MerchantSummary[]): ClassifyResult {
  const summary: ClassificationSummary = { ...EMPTY_SUMMARY };
  const classified = merchants.map((m) => {
    const result = classifyMerchant(m);
    addToSummary(summary, result.classification.category);
    return result;
  });
  summary.needsReview = summary.unknownCount;
  return { merchants: classified, summary };
}

// True when any token of a merchant key/canonical name is a curated
// non-software category word. Runs only after the dictionary and mixed/processor
// guards, so a software merchant key can't be misread as a category.
function matchesNonSoftwareCategory(text: string): boolean {
  if (text === "") return false;
  return text.split(" ").some((word) => NON_SOFTWARE_CATEGORIES.has(word));
}

function addToSummary(summary: ClassificationSummary, category: MerchantCategory): void {
  summary.totalClassified += 1;
  switch (category) {
    case "likely_saas":
      summary.likelySaasCount += 1;
      break;
    case "likely_software":
      summary.likelySoftwareCount += 1;
      break;
    case "not_software":
      summary.notSoftwareCount += 1;
      break;
    case "unknown":
      summary.unknownCount += 1;
      break;
  }
}
