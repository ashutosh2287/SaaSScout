import type { MerchantSummary, NormalizedTransactionWithMerchant } from "./types";

export function groupMerchants(
  enriched: NormalizedTransactionWithMerchant[],
): MerchantSummary[] {
  const groups = new Map<string, MerchantSummary>();

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
    }

    g.transactionCount += 1;
    if (t.date) {
      if (g.firstSeen === undefined || t.date < g.firstSeen) g.firstSeen = t.date;
      if (g.lastSeen === undefined || t.date > g.lastSeen) g.lastSeen = t.date;
    }
    if (t.description !== "" && !g.distinctRawDescriptions.includes(t.description)) {
      g.distinctRawDescriptions.push(t.description);
    }
  }

  return [...groups.values()].sort((a, b) => b.transactionCount - a.transactionCount);
}