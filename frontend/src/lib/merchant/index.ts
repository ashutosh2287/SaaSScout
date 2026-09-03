import { groupMerchants } from "./group";
import { normalizeMerchant } from "./normalize";
import type { MerchantNormalizationResult, NormalizedTransactionWithMerchant } from "./types";
import type { NormalizedTransaction } from "../parse/types";

export function normalizeMerchants(
  transactions: NormalizedTransaction[],
): MerchantNormalizationResult {
  let resolvedCount = 0;
  let unresolvedCount = 0;

  const enriched: NormalizedTransactionWithMerchant[] = transactions.map((t) => {
    const merchant = normalizeMerchant(t.description);
    if (merchant.canonicalName === null) unresolvedCount++;
    else resolvedCount++;
    return { ...t, merchant };
  });

  const merchants = groupMerchants(enriched);

  return { transactions: enriched, merchants, resolvedCount, unresolvedCount };
}

export { buildMerchantKey, normalizeMerchant } from "./normalize";
export { cleanDescription } from "./clean";
export { groupMerchants } from "./group";
export type {
  MerchantDefinition,
  MerchantIdentity,
  MerchantMatchSource,
  MerchantConfidence,
  MerchantNormalizationResult,
  MerchantSummary,
  NormalizedTransactionWithMerchant,
} from "./types";