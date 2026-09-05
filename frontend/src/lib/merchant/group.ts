import type { MerchantSummary, NormalizedTransactionWithMerchant } from "./types";

export function groupMerchants(
  enriched: NormalizedTransactionWithMerchant[],
): MerchantSummary[] {
  const groups = new Map<string, MerchantSummary>();
  // O(1)-per-row "already seen" check. The old linear distinctRawDescriptions
  // scan was O(rows x distinct) and quadratically blew up on a single large
  // merchant with many description variants (measured: 24s at 40k rows).
  const seenDescriptions = new Map<string, Set<string>>();

  for (const t of enriched) {
    const m = t.merchant;
    if (m.normalizedKey === null || m.canonicalName === null) continue;

    let g = groups.get(m.normalizedKey);
    if (!g) {
      g = {
        normalizedKey: m.normalizedKey,
        canonicalName: m.canonicalName,
        transactionCount: 0,
        distinctRawDescriptions: [],
      };
      groups.set(m.normalizedKey, g);
      seenDescriptions.set(m.normalizedKey, new Set());
    }

    g.transactionCount += 1;
    if (t.date) {
      if (g.firstSeen === undefined || t.date < g.firstSeen) g.firstSeen = t.date;
      if (g.lastSeen === undefined || t.date > g.lastSeen) g.lastSeen = t.date;
    }
    if (t.description !== "" && !seenDescriptions.get(m.normalizedKey)!.has(t.description)) {
      seenDescriptions.get(m.normalizedKey)!.add(t.description);
      g.distinctRawDescriptions.push(t.description);
    }
  }

  return [...groups.values()].sort((a, b) => b.transactionCount - a.transactionCount);
}