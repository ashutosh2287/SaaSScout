import type { SasscoutReport } from "../report/types";
import type { RecurringPattern } from "../recurring/types";
import type { ComparisonFinding } from "./types";
import {
  OVERLAP_ELIGIBLE_SUBCATEGORIES,
  subcategoryFor,
  type SoftwareSubcategory,
} from "./subcategories";

// Step 26 — intra-period overlap detection.
//
// Pure function over a SINGLE report. The "intra-period" name is honest: the
// evidence is the current report's own data (recurring status, classification
// subcategory, and shared window), NOT a claim that one merchant is a duplicate
// of the other. The finding never says "cancel the second one"; it says
// "two recurring tools share a subcategory — confirm you need both".
//
// Honesty gates (in order; a pair is only emitted if ALL hold):
//   1. BOTH merchants must be classified as software (likely_saas / likely_software).
//   2. BOTH must carry an interval-bearing recurring pattern in the current
//      report (likely_recurring or possibly_recurring with a concrete
//      interval). One-off charges are not overlap candidates — a single
//      Adobe charge and a single Canva charge do not signal duplication.
//   3. BOTH must map to the same curated SoftwareSubcategory (see
//      subcategories.ts). Two unknown vendors cannot be invented into a
//      pair; the map is the only path to a subcategory.
//   4. The shared subcategory must be in OVERLAP_ELIGIBLE_SUBCATEGORIES.
//      Some categories (hosting-infrastructure, developer-tools) admit
//      legitimate multi-vendor setups that the finding would over-claim.
//   5. Pairs are deduplicated by sorted (keyA, keyB) so the same two
//      merchants do not produce two findings.
//
// Confidence:
//   - high:   both likely_recurring
//   - medium: one likely_recurring and one possibly_recurring
//   - low:    both possibly_recurring
//
// No impact figures are emitted (impact: { monthlyDelta: null, yearlyDelta: null }):
// the engine cannot honestly state a spend delta from "two tools exist".

export function detectIntraPeriodOverlaps(report: SasscoutReport): ComparisonFinding[] {
  const findings: ComparisonFinding[] = [];
  const seen = new Set<string>();

  // Build a per-subcategory list of eligible software-recurring merchants in
  // this report. Single pass; O(n) over merchants.
  const bySub = new Map<SoftwareSubcategory, Array<{ key: string; name: string; pattern: RecurringPattern }>>();
  for (const m of report.merchants) {
    if (m.softwareStatus !== "software") continue;
    const sub = subcategoryFor(m.normalizedKey);
    if (sub === null) continue;
    if (!OVERLAP_ELIGIBLE_SUBCATEGORIES.has(sub)) continue;
    const r = m.recurring;
    if (!r) continue;
    if (r.status !== "likely_recurring" && r.status !== "possibly_recurring") continue;
    if (r.interval === null || r.interval === "irregular") continue;
    const list = bySub.get(sub) ?? [];
    list.push({ key: m.normalizedKey, name: m.merchantName, pattern: r });
    bySub.set(sub, list);
  }

  for (const [sub, list] of bySub) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        // Deterministic ordering: the alphabetically-earlier key is the
        // primary; the later key is the pair. This makes the React key and
        // the finding order stable across runs.
        const [primary, secondary] = a.key <= b.key ? [a, b] : [b, a];
        const dedup = `${sub}:${primary.key}:${secondary.key}`;
        if (seen.has(dedup)) continue;
        seen.add(dedup);

        const bothLikely =
          a.pattern.status === "likely_recurring" && b.pattern.status === "likely_recurring";
        const bothPossible =
          a.pattern.status === "possibly_recurring" && b.pattern.status === "possibly_recurring";
        const confidence: ComparisonFinding["confidence"] = bothLikely
          ? "high"
          : bothPossible
            ? "low"
            : "medium";

        findings.push({
          kind: "possible_overlap",
          merchantKey: primary.key,
          merchantName: primary.name,
          confidence,
          impact: { monthlyDelta: null, yearlyDelta: null },
          pair: { merchantKey: secondary.key, merchantName: secondary.name, subcategory: sub },
          evidence: [
            {
              type: "shared_subcategory",
              message: `Both ${primary.name} and ${secondary.name} are classified as ${sub.replace(/-/g, " ")} software in the current period.`,
            },
            {
              type: "both_recurring_current",
              message: `Both are billed on a recurring cadence in the current report (${primary.name}: ${a.pattern.interval}, ${secondary.name}: ${b.pattern.interval}).`,
            },
            {
              type: "overlap_not_duplication",
              message: "Sharing a category is not the same as one being a duplicate of the other — the next step is to confirm both are still in active use.",
            },
          ],
        });
      }
    }
  }

  // Sort by subcategory, then by primary name, so the output is deterministic.
  findings.sort((x, y) => {
    const s = (x.pair?.subcategory ?? "").localeCompare(y.pair?.subcategory ?? "");
    if (s !== 0) return s;
    return x.merchantName.localeCompare(y.merchantName);
  });

  return findings;
}
