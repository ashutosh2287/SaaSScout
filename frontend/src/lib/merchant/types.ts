import type { NormalizedTransaction } from "../parse/types";

export type MerchantMatchSource = "dictionary" | "deterministic" | "unresolved";

export type MerchantConfidence = "high" | "medium" | "low";

export type MerchantIdentity = {
  canonicalName: string | null;
  normalizedKey: string | null;
  source: MerchantMatchSource;
  confidence: MerchantConfidence;
  rawDescription: string;
  cleanedDescription: string;
};

// A transaction with its enrichment attached. The original description is kept
// intact on the transaction; `merchant` is a separate, evidence-preserving view.
export type NormalizedTransactionWithMerchant = NormalizedTransaction & {
  merchant: MerchantIdentity;
};

export type MerchantSummary = {
  normalizedKey: string;
  canonicalName: string;
  transactionCount: number;
  firstSeen?: string;
  lastSeen?: string;
  distinctRawDescriptions: string[];
};

export type MerchantNormalizationResult = {
  transactions: NormalizedTransactionWithMerchant[];
  merchants: MerchantSummary[];
  resolvedCount: number;
  unresolvedCount: number;
};

export type MerchantDefinition = {
  canonicalName: string;
  root: string;
  aliases: string[];
};