import {
  ABSENCE_EVIDENCE_MIN_CYCLES,
  ABSENCE_EVIDENCE_STRONG_CYCLES,
  BASELINE_WEAK_CONSISTENCY_MAX,
  DESCRIPTOR_OVERLAP_MIN_DICE,
  GENERIC_DESC_TOKENS,
  INTERVAL_PERIOD_DAYS,
  IRREGULAR_MIN_CHARGES,
  MATERIAL_PRICE_MIN_ABS_DOLLARS,
  MATERIAL_PRICE_MIN_RELATIVE,
  PRESENCE_CHANGE_CONFIDENCE,
  REFUND_MARKER_TOKENS,
  WEEKLY_INTERVAL_MAX_CONFIDENCE,
} from "./constants";
import type {
  ComparisonConfidence,
  ComparisonEvidence,
  ComparisonFinding,
  ComparisonResult,
  ComparisonKind,
  ReportRef,
  SuppressedHypothesis,
  SuppressionCategory,
} from "./types";
import type { SasscoutReport } from "../report/types";
import type { RecurringInterval, RecurringPattern } from "../recurring/types";

const DAY_MS = 86_400_000;

function dayDiff(from: string, to: string): number {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / DAY_MS);
}

function concretePeriodDays(interval: RecurringInterval | null): number | null {
  if (
    interval === null ||
    interval === "irregular"
  ) {
    return null;
  }
  return INTERVAL_PERIOD_DAYS[interval];
}

// interval-bearing recurring pattern: a concrete cadence on a recurring status.
function intervalCarrying(p: RecurringPattern | null): boolean {
  if (!p) return false;
  if (p.status !== "likely_recurring" && p.status !== "possibly_recurring") return false;
  return concretePeriodDays(p.interval) !== null;
}

function windowOf(report: SasscoutReport): { start: string | null; end: string | null; days: number | null } {
  const start = report.quality.date?.earliest ?? null;
  const end = report.quality.date?.latest ?? null;
  let days: number | null = null;
  if (start && end) {
    const d = dayDiff(start, end);
    days = Number.isNaN(d) ? null : d;
  }
  return { start, end, days };
}

// Cycles of the merchant cadence the window would capture. null when we cannot
// tell (unknown window or no cadence).
function cyclesCovered(windowDays: number | null, periodDays: number | null): number | null {
  if (windowDays === null || periodDays === null || periodDays <= 0) return null;
  return windowDays / periodDays;
}

// Days of observed absence for a merchant that vanished between reports.
// Anchored to the merchant's LAST OBSERVED CHARGE and the current window's
// start (the first day the current data actually covers). Days where the
// merchant is provably still present in the baseline are excluded, so an
// overlapping window cannot inflate the absence evidence. This is the
// transaction-edge evidence the saved report preserves (charge boundaries).
function observedAbsenceDays(
  lastSeen: string | null,
  windowStart: string | null,
  windowEnd: string | null,
): number | null {
  if (!windowEnd) return null;
  if (!lastSeen) return windowStart ? dayDiff(windowStart, windowEnd) : null;
  const anchor = windowStart && windowStart > lastSeen ? windowStart : lastSeen;
  const d = dayDiff(anchor, windowEnd);
  return Number.isNaN(d) ? null : Math.max(0, d);
}

function spanDays(first: string | null, last: string | null): number | null {
  if (!first || !last) return null;
  const d = dayDiff(first, last);
  return Number.isNaN(d) ? null : d;
}

// Identity-uncertainty (Case E): lowercase tokens of raw statement descriptions,
// with generic corporate/domain words removed.
function descTokens(descriptions: string[]): string[] {
  const out = new Set<string>();
  for (const d of descriptions) {
    for (const tok of d.toLowerCase().split(/[^a-z0-9]+/)) {
      if (tok && !GENERIC_DESC_TOKENS.has(tok)) out.add(tok);
    }
  }
  return [...out];
}

function diceSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  let inter = 0;
  for (const t of a) if (bSet.has(t)) inter += 1;
  return (2 * inter) / (a.length + b.length);
}

// True when surviving current-period evidence describes a charge that is STILL
// HAPPENING but whose cadence no longer holds together (Case B): at least the
// minimum charge count, spread over at least one expected baseline cycle, and
// without a reliable dominant interval. Fewer charges cannot separate a broken
// cadence from a cancelled service's final bills — those stay suppressed.
function cadenceBrokenEvidence(
  bR: RecurringPattern | null,
  baselinePeriodDays: number,
): boolean {
  if (!bR) return false;
  if (bR.status === "likely_recurring") return false;
  if (bR.transactionCount < IRREGULAR_MIN_CHARGES) return false;
  const span = spanDays(bR.firstSeen, bR.lastSeen);
  if (span === null || span < baselinePeriodDays) return false;
  if (bR.interval === "irregular") return true;
  return bR.intervalConsistency < BASELINE_WEAK_CONSISTENCY_MAX;
}

function evidence(type: ComparisonEvidence["type"], message: string): ComparisonEvidence {
  return { type, message };
}

function confidenceCapForInterval(
  base: ComparisonConfidence,
  interval: RecurringInterval | null,
): ComparisonConfidence {
  if (interval === "weekly" && base === "high") return WEEKLY_INTERVAL_MAX_CONFIDENCE;
  return base;
}

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function annualized(amount: number, periodDays: number): number {
  return amount * (365 / periodDays);
}

export function compareReports(
  baseline: SasscoutReport,
  current: SasscoutReport,
  labels?: { baseline?: string; current?: string },
): ComparisonResult {
  const bRef: ReportRef = {
    label: labels?.baseline ?? baseline.file.name,
    window: windowOf(baseline),
    generatedAt: baseline.generatedAt,
  };
  const cRef: ReportRef = {
    label: labels?.current ?? current.file.name,
    window: windowOf(current),
    generatedAt: current.generatedAt,
  };

  const findings: ComparisonFinding[] = [];
  const suppressed: SuppressedHypothesis[] = [];
  const insufficientEvidence: SuppressedHypothesis[] = [];

  const bByKey = new Map(baseline.merchants.map((m) => [m.normalizedKey, m]));
  const cByKey = new Map(current.merchants.map((m) => [m.normalizedKey, m]));
  const keys = new Set([...bByKey.keys(), ...cByKey.keys()]);

  // Identity-uncertainty pre-pass (Case E). Pair every software merchant that
  // vanished from the current period with any DIFFERENT merchant that appears
  // only now and shares its raw statement descriptions. A disappeared charge
  // whose description reappears under another identity is never called ended —
  // it may simply have been re-descripted. Token-indexed, so this is linear in
  // merchants, independent of transaction-row count.
  const identityLinkedTo = new Map<string, Set<string>>(); // absent key -> appearing keys
  const identityLinkedFrom = new Map<string, Set<string>>(); // appearing key -> absent keys
  const absentSoftwareKeys: string[] = [];
  const appearingKeys: string[] = [];
  for (const key of keys) {
    const aM = bByKey.get(key);
    const bM = cByKey.get(key);
    if (aM && !bM && aM.softwareStatus === "software") absentSoftwareKeys.push(key);
    if (bM && !aM) appearingKeys.push(key);
  }
  const appearingByToken = new Map<string, string[]>();
  for (const key of appearingKeys) {
    for (const t of descTokens(cByKey.get(key)!.distinctRawDescriptions)) {
      const list = appearingByToken.get(t);
      if (list) list.push(key);
      else appearingByToken.set(t, [key]);
    }
  }
  // An appearing merchant is a plausible "same charge re-descripted" only if it
  // is not the refund/reversal aftermath of the vanished charge (a refund line
  // proves a bill was settled, not that the subscription continued) and its net
  // spend is not definitively money flowing IN (outright credits).
  const plausibleContinuation = (key: string): boolean => {
    const m = cByKey.get(key)!;
    const tot = m.totalSpend;
    if (tot !== null && tot >= 0) return false;
    return !m.distinctRawDescriptions.some((d) => {
      const tokens = d.toLowerCase().split(/[^a-z0-9]+/);
      return tokens.some((t) => REFUND_MARKER_TOKENS.has(t));
    });
  };
  for (const key of absentSoftwareKeys) {
    const aM = bByKey.get(key)!;
    const tokens = descTokens(aM.distinctRawDescriptions);
    if (tokens.length === 0) continue;
    const considered = new Set<string>();
    for (const t of tokens) {
      for (const other of appearingByToken.get(t) ?? []) {
        if (considered.has(other)) continue;
        considered.add(other);
        if (!plausibleContinuation(other)) continue;
        const dice = diceSimilarity(
          tokens,
          descTokens(cByKey.get(other)!.distinctRawDescriptions),
        );
        if (dice >= DESCRIPTOR_OVERLAP_MIN_DICE) {
          if (!identityLinkedTo.has(key)) identityLinkedTo.set(key, new Set());
          identityLinkedTo.get(key)!.add(other);
          if (!identityLinkedFrom.has(other)) identityLinkedFrom.set(other, new Set());
          identityLinkedFrom.get(other)!.add(key);
        }
      }
    }
  }

  const isSoftware = (m: { softwareStatus: string | null } | undefined): boolean =>
    m?.softwareStatus === "software";

  const suppress = (
    list: SuppressedHypothesis[],
    rule: ComparisonKind,
    key: string,
    name: string,
    reason: string,
    category: SuppressionCategory = "insufficient_observation",
  ) => list.push({ merchantKey: key, merchantName: name, rule, reason, category });

  for (const key of [...keys].sort()) {
    const aM = bByKey.get(key);
    const bM = cByKey.get(key);
    const name = (aM?.merchantName ?? bM?.merchantName ?? key) as string;
    const aR = aM?.recurring ?? null;
    const bR = bM?.recurring ?? null;
    const aSoftware = isSoftware(aM);
    const bSoftware = isSoftware(bM);

    // ---------- present in both ----------
    if (aM && bM) {
      const aInterval = intervalCarrying(aR);
      const bInterval = intervalCarrying(bR);

      // 3. MATERIAL PRICE CHANGE -------------------------------------------------
      const aT = aR?.typicalAmount ?? null;
      const bT = bR?.typicalAmount ?? null;
      if (aSoftware && bSoftware && aInterval && bInterval && aT !== null && bT !== null && aT > 0) {
        const pct = Math.abs(bT - aT) / aT;
        const absDelta = Math.abs(bT - aT);
        if (pct >= MATERIAL_PRICE_MIN_RELATIVE && absDelta >= MATERIAL_PRICE_MIN_ABS_DOLLARS) {
          const increase = bT > aT;
          let conf: ComparisonConfidence = "medium";
          const bothLikely = aR?.status === "likely_recurring" && bR?.status === "likely_recurring";
          const bothStable =
            (aR?.amountProfile === "highly_stable" || aR?.amountProfile === "moderately_stable") &&
            (bR?.amountProfile === "highly_stable" || bR?.amountProfile === "moderately_stable");
          if (bothLikely && bothStable) conf = "high";
          if ((aR?.amountProfile ?? null) === "variable" || (bR?.amountProfile ?? null) === "variable") {
            conf = "medium";
          }
          const periodDays = concretePeriodDays(bR?.interval ?? null) ?? 30;
          const monthlyDelta = increase ? bT - aT : aT - bT;
          const yearlyDelta = annualized(monthlyDelta, periodDays);
          const ev: ComparisonEvidence[] = [
            evidence("typical_amount_baseline", `Typical charge in the earlier period: ${fmtMoney(aT)}`),
            evidence("typical_amount_current", `Typical charge in the current period: ${fmtMoney(bT)}`),
          ];
          if ((aR?.amountProfile ?? null) === "variable" || (bR?.amountProfile ?? null) === "variable") {
            ev.push(evidence("amount_unstable", "One period's amounts vary, so the step is approximate."));
          }
          findings.push({
            kind: increase ? "price_increase" : "price_decrease",
            merchantKey: key,
            merchantName: name,
            confidence: conf,
            evidence: ev,
            impact: { monthlyDelta, yearlyDelta },
          });
        }
      }

      // 4. FREQUENCY CHANGE ------------------------------------------------------
      if (aSoftware && bSoftware && aInterval && bInterval && aR?.interval !== bR?.interval) {
        let conf: ComparisonConfidence = "medium";
        if (aR?.status === "likely_recurring" && bR?.status === "likely_recurring") conf = "high";
        const periodDaysB = concretePeriodDays(bR!.interval) ?? 30;
        const periodDaysA = concretePeriodDays(aR!.interval) ?? 30;
        const aAnnual =
          aT !== null ? annualized(aT, periodDaysA) : null;
        const bAnnual =
          bT !== null ? annualized(bT, periodDaysB) : null;
        const yearlyDelta =
          aAnnual !== null && bAnnual !== null ? bAnnual - aAnnual : null;
        findings.push({
          kind: "frequency_change",
          merchantKey: key,
          merchantName: name,
          confidence: confidenceCapForInterval(conf, bR!.interval),
          evidence: [
            evidence("interval_baseline", `Earlier period interval: ${aR!.interval}`),
            evidence("interval_current", `Current period interval: ${bR!.interval}`),
            evidence("window_covers_cycle", "Both periods show a recurring pattern at a concrete cadence."),
          ],
          impact: { monthlyDelta: null, yearlyDelta },
        });
        continue;
      }
      if (aInterval && aR?.interval === bR?.interval) {
        // same cadence, both recurring, no material price step -> stable.
        continue;
      }

      // 2b. cadence WAS recurring, spend continues, pattern broke ---------------
      // Honest split using surviving cadence-gap evidence (interval consistency,
      // transaction count, charge span — the aggregate trace the saved report
      // keeps of the charge dates). When the current period STILL shows a real
      // scattering of charges spanning more than one expected cycle, that is
      // Case B (became irregular) — a visible low-confidence finding, never an
      // "ended" claim. A residual trace too thin to separate a broken cadence
      // from a cancelled service's final bills stays suppressed (Case C).
      if (aSoftware && bSoftware && aInterval && !bInterval) {
        const baselinePeriodDays = concretePeriodDays(aR!.interval) ?? 0;
        const bTxnCount = bR?.transactionCount ?? bM!.transactionCount;
        if (cadenceBrokenEvidence(bR, baselinePeriodDays)) {
          findings.push({
            kind: "pattern_irregular",
            merchantKey: key,
            merchantName: name,
            confidence: PRESENCE_CHANGE_CONFIDENCE,
            evidence: [
              evidence("recurring_baseline", `Earlier period: recurring at ${aR!.interval} cadence.`),
              evidence("spend_continues", `This merchant is still charging in the current period (${bTxnCount} charges observed).`),
              evidence("irregular_pattern", `The gaps between those charges no longer match a reliable ${aR!.interval} cadence (${Math.round((bR?.intervalConsistency ?? 0) * 100)}% interval consistency), so the cadence weakened rather than continuing cleanly.`),
              evidence("not_ended", "Charges are still occurring, so this is NOT an ended subscription; the raw data shows spending drifting from a regular cadence to occasional."),
            ],
            impact: { monthlyDelta: null, yearlyDelta: null },
          });
        } else {
          suppress(
            insufficientEvidence,
            "ended_recurring",
            key,
            name,
            bTxnCount < IRREGULAR_MIN_CHARGES
              ? `This merchant was recurring in the earlier period and still charges now, but only ${bTxnCount} transaction(s) appear here — too few to distinguish a broken cadence from a cancelled service's final charges. Left unclaimed.`
              : "This merchant was recurring in the earlier period and still charges now, but its observed spread is too short to evaluate the cadence. Aggregate period data cannot separate a broken cadence from a run of missed months, so this is left unclaimed.",
          );
        }
        continue;
      }

      // 1b. was a one-off, now recurring -----------------------------------------
      if (aSoftware && !aInterval && bInterval) {
        findings.push({
          kind: "new_recurring",
          merchantKey: key,
          merchantName: name,
          confidence: "medium",
          evidence: [
            evidence("spend_was_one_off", "Earlier period: spend existed but was not recurring."),
            evidence("recurring_current", `Current period: recurring at ${bR!.interval} cadence.`),
            evidence("present_current", "Merchant present in both periods."),
          ],
          impact: {
            monthlyDelta: null,
            yearlyDelta: bR!.typicalAmount !== null
              ? annualized(bR!.typicalAmount, concretePeriodDays(bR!.interval) ?? 30)
              : null,
          },
        });
        continue;
      }

      // same cadence recurring, or both non-recurring -> nothing to claim.
      continue;
    }

    // ---------- present in baseline only (POSSIBLE ENDED / DISAPPEARED) ----------
    if (aM && !bM) {
      if (!aSoftware) continue;

      // Identity-uncertainty (Case E): a re-descripted charge must never read
      // as an ended subscription.
      const linked = identityLinkedTo.get(key);
      if (linked && linked.size > 0) {
        const other = [...linked][0];
        suppress(
          insufficientEvidence,
          intervalCarrying(aR) ? "ended_recurring" : "merchant_disappeared",
          key,
          name,
          `Raw transaction descriptions for ${name} overlap with ${cByKey.get(other)!.merchantName}, which appears in the current period. This may be a descriptor or identity change rather than an ended charge (${name} is not in the current period), so it is not called ended.`,
          "identity_uncertain",
        );
        continue;
      }

      if (intervalCarrying(aR)) {
        const periodDays = concretePeriodDays(aR!.interval);
        const lastSeen = aR?.lastSeen ?? aM.lastSeen ?? null;
        const absenceDays = observedAbsenceDays(lastSeen, cRef.window.start, cRef.window.end);
        const cycles = cyclesCovered(absenceDays, periodDays);
        if (cycles === null || cycles < ABSENCE_EVIDENCE_MIN_CYCLES) {
          suppress(
            insufficientEvidence,
            "ended_recurring",
            key,
            name,
            cRef.window.days === null
              ? "Current period has no usable date window, so an absent merchant cannot be called ended."
              : `Only ${absenceDays ?? "?"} day(s) of absence are observed since its last charge (${lastSeen ?? "unknown"}); that covers ${cycles === null ? "?" : cycles.toFixed(1)} expected cycle(s), so the charge may simply land outside the data. Left unclaimed.`,
          );
          continue;
        }
        const baselineReliable =
          aR?.status === "likely_recurring" &&
          (aR?.intervalConsistency ?? 0) >= BASELINE_WEAK_CONSISTENCY_MAX;
        const conf: ComparisonConfidence =
          cycles >= ABSENCE_EVIDENCE_STRONG_CYCLES && baselineReliable
            ? "high"
            : "medium";
        const ev: ComparisonEvidence[] = [
          evidence("recurring_baseline", `Earlier period: recurring at ${aR!.interval} cadence.`),
          ...(lastSeen
            ? [evidence("last_charge_observed", `Last observed charge: ${lastSeen}.`)]
            : []),
          evidence(
            "absent_current",
            `No ${name} charges appear in the current period; data observed through ${cRef.window.end ?? "the end of the current period"}.`,
          ),
          evidence("window_covers_cycle", `The observed window since the last charge covers ${cycles.toFixed(1)} expected ${aR!.interval} cycle(s).`),
        ];
        if (!baselineReliable) {
          ev.push(
            evidence(
              "pattern_baseline_weak",
              `The earlier pattern itself was not fully regular (${Math.round((aR?.intervalConsistency ?? 0) * 100)}% cadence consistency), so even this absence is not high-confidence proof of an end.`,
            ),
          );
        }
        findings.push({
          kind: "ended_recurring",
          merchantKey: key,
          merchantName: name,
          confidence: confidenceCapForInterval(conf, aR!.interval),
          evidence: ev,
          impact: {
            monthlyDelta: null,
            yearlyDelta: aR!.typicalAmount !== null
              ? -annualized(aR!.typicalAmount, periodDays ?? 30)
              : null,
          },
        });
        continue;
      }

      findings.push({
        kind: "merchant_disappeared",
        merchantKey: key,
        merchantName: name,
        confidence: PRESENCE_CHANGE_CONFIDENCE,
        evidence: [
          evidence("present_baseline", `Software spend present in the earlier period ($${(aM.totalSpend ?? 0).toFixed(2)} total).`),
          evidence("absent_current", "No spend for this merchant appears in the current period."),
          evidence("window_insufficient", "This merchant was not recurring, so its cadence is unknown; absence may simply be a one-off that did not repeat."),
        ],
        impact: { monthlyDelta: null, yearlyDelta: null },
      });
      continue;
    }

    // ---------- present in current only (POSSIBLE NEW / APPEARED) ----------
    if (bM && !aM) {
      if (!bSoftware) continue;

      // Symmetric identity guard: a merchant that appears now while an
      // absent earlier-period merchant shares its descriptions may be the
      // same charge re-descripted, not a new subscription.
      const linked = identityLinkedFrom.get(key);
      if (linked && linked.size > 0) {
        const other = [...linked][0];
        suppress(
          insufficientEvidence,
          intervalCarrying(bR) ? "new_recurring" : "merchant_appeared",
          key,
          name,
          `Raw transaction descriptions for ${name} overlap with ${bByKey.get(other)!.merchantName}, which appears in the earlier period. This may be the same merchant under a changed descriptor rather than a new charge, so it is not called new.`,
          "identity_uncertain",
        );
        continue;
      }

      if (intervalCarrying(bR)) {
        const periodDays = concretePeriodDays(bR!.interval);
        const cycles = cyclesCovered(bRef.window.days, periodDays);
        if (cycles === null || cycles < ABSENCE_EVIDENCE_MIN_CYCLES) {
          suppress(
            insufficientEvidence,
            "new_recurring",
            key,
            name,
            bRef.window.days === null
              ? "Baseline period has no usable date window, so this recurring charge cannot be proven new."
              : `Baseline window covers only ${cycles === null ? "?" : cycles.toFixed(1)} expected cycle(s); this merchant may have charged just outside it.`,
          );
          continue;
        }
        const conf: ComparisonConfidence =
          cycles >= ABSENCE_EVIDENCE_STRONG_CYCLES && bR?.status === "likely_recurring"
            ? "high"
            : "medium";
        findings.push({
          kind: "new_recurring",
          merchantKey: key,
          merchantName: name,
          confidence: confidenceCapForInterval(conf, bR!.interval),
          evidence: [
            evidence("absent_baseline", `No ${name} transactions appear in the baseline period (${bRef.window.start} to ${bRef.window.end}).`),
            evidence("recurring_current", `Current period: recurring at ${bR!.interval} cadence.`),
            ...(bR?.firstSeen
              ? [evidence("first_charge_current", `First observed charge: ${bR.firstSeen}.`)]
              : []),
            evidence("window_covers_cycle", `The baseline window covers ${cycles >= ABSENCE_EVIDENCE_STRONG_CYCLES ? "at least two" : "at least one"} expected charge cycle${cycles >= ABSENCE_EVIDENCE_STRONG_CYCLES ? "s" : ""} without this merchant`),
          ],
          impact: {
            monthlyDelta: null,
            yearlyDelta: bR!.typicalAmount !== null
              ? annualized(bR!.typicalAmount, periodDays ?? 30)
              : null,
          },
        });
        continue;
      }

      findings.push({
        kind: "merchant_appeared",
        merchantKey: key,
        merchantName: name,
        confidence: PRESENCE_CHANGE_CONFIDENCE,
        evidence: [
          evidence("present_current", `Software spend present in the current period ($${(bM.totalSpend ?? 0).toFixed(2)} total).`),
          evidence("absent_baseline", "No spend for this merchant appears in the baseline period."),
          evidence("window_insufficient", "This merchant is not recurring, so this is informational presence change — not proof of a new subscription."),
        ],
        impact: { monthlyDelta: null, yearlyDelta: null },
      });
      continue;
    }
  }

  // Window-order honesty check: if both windows are known but the baseline is
  // labeled "earlier" while it actually starts later, the direction of every
  // finding is reversed from what the labels claim.
  let caution: string | null = null;
  if (
    bRef.window.start !== null &&
    cRef.window.start !== null &&
    bRef.window.start > cRef.window.start
  ) {
    caution =
      "The baseline/current periods overlap in an unexpected order (baseline starts after current). Findings still reflect data as reported, but check the periods you selected.";
  }

  // Deterministic ordering: kind, then merchant name.
  const kindOrder: Record<ComparisonKind, number> = {
    new_recurring: 0,
    ended_recurring: 1,
    price_increase: 2,
    price_decrease: 3,
    frequency_change: 4,
    pattern_irregular: 5,
    merchant_appeared: 6,
    merchant_disappeared: 7,
  };
  findings.sort((x, y) =>
    kindOrder[x.kind] - kindOrder[y.kind] || x.merchantName.localeCompare(y.merchantName),
  );

  return { baseline: bRef, current: cRef, ordered: !caution, caution, findings, suppressed, insufficientEvidence };
}

export { windowOf, cyclesCovered, concretePeriodDays, observedAbsenceDays, cadenceBrokenEvidence };