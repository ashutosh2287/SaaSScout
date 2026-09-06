import { describe, expect, it } from "vitest";
import type { NormalizedTransaction } from "../parse/types";
import type { ParseResult } from "../parse/types";
import { inspectDataQuality } from "../quality";
import { normalizeMerchants } from "../merchant";
import { classifyMerchants } from "../classification";
import { detectRecurring } from "../recurring";
import { aggregateSoftwareSpend } from "../software";
import { detectSpendReviews } from "../leak";
import { buildReport } from "../report/build";
import type { SasscoutReport } from "../report/types";
import { compareReports } from "./engine";
import { SCENARIOS, SCENARIO_COUNT } from "./dataset";

const DUMP_PATH = process.env.STEP19_DUMP;
const sheet: string[] = [];

function buildReportFor(txns: NormalizedTransaction[], fileName: string): SasscoutReport {
  const parseResult: ParseResult = {
    file: { name: fileName },
    transactions: txns,
    totalRows: txns.length,
    parsedRows: txns.length,
    skippedRows: 0,
    errors: [],
    warnings: [],
    columns: {},
    columnDiagnostics: { detected: {}, missing: [], ambiguous: [] },
    currency: null,
  };
  const quality = inspectDataQuality(txns);
  const merchantResult = normalizeMerchants(txns);
  const classification = classifyMerchants(merchantResult.merchants);
  const recurring = detectRecurring(merchantResult.transactions);
  const software = aggregateSoftwareSpend(
    merchantResult.transactions,
    classification.merchants,
    recurring.patterns,
  );
  const review = detectSpendReviews(software.merchants, quality);
  return buildReport(
    {
      parse: parseResult,
      quality,
      classification,
      recurring,
      software,
      review,
    },
    { generatedAt: "2026-09-05T00:00:00.000Z" },
  );
}

function runScenario(scenario: (typeof SCENARIOS)[number]) {
  const a = buildReportFor(scenario.a, "baseline.csv");
  const b = buildReportFor(scenario.b, "current.csv");
  return compareReports(a, b, { baseline: "baseline.csv", current: "current.csv" });
}

describe("Phase 18/19 — comparison ground truth (measurement)", () => {
  const errors: string[] = [];
  const total = {
    tp: 0,
    fp: 0,
    fn: 0,
    suppressedObservation: 0,
    suppressedIdentity: 0,
    scenarios: 0,
  };

  for (const scenario of SCENARIOS) {
    it(`[${scenario.name}] hits its ground-truth contract`, () => {
      const result = runScenario(scenario);
      total.scenarios += 1;
      total.suppressedObservation += result.insufficientEvidence.filter(
        (h) => h.category !== "identity_uncertain",
      ).length;
      total.suppressedIdentity += result.insufficientEvidence.filter(
        (h) => h.category === "identity_uncertain",
      ).length;

      const emitted = result.findings.map((f) => f.kind);
      const emittedKeys = result.findings.map((f) => `${f.kind}:${f.merchantKey}`);

      const problems: string[] = [];
      for (const e of scenario.expected) {
        const finding = result.findings.find(
          (f) => f.kind === e.kind && f.merchantKey === e.key,
        );
        if (!finding) {
          problems.push(`missing expected finding ${e.kind} (${e.key})`);
          total.fn += 1;
          continue;
        }
        total.tp += 1;
        if (e.confidenceAtLeast && !confidenceAtLeast(finding.confidence, e.confidenceAtLeast)) {
          problems.push(
            `${e.kind} (${e.key}) confidence ${finding.confidence} below floor ${e.confidenceAtLeast}`,
          );
        }
        if (e.confidenceBelow && confidenceAtLeast(finding.confidence, e.confidenceBelow)) {
          problems.push(
            `${e.kind} (${e.key}) confidence ${finding.confidence} not kept below ${e.confidenceBelow} (honesty ceiling violated)`,
          );
        }
      }

      for (const kind of scenario.expectedNone) {
        if (emitted.includes(kind)) {
          problems.push(`unexpected finding kind ${kind}`);
          const bad = result.findings.filter((f) => f.kind === kind);
          total.fp += bad.length;
        }
      }

      // Any emitted finding outside the explicit expected list counts as FP.
      const expectedKeys = new Set(
        scenario.expected.map((e) => `${e.kind}:${e.key}`),
      );
      const stray = emittedKeys.filter((k) => !expectedKeys.has(k));
      if (stray.length > 0) {
        problems.push(`stray findings: ${stray.join(", ")}`);
        total.fp += stray.length;
      }

      // Insufficient-evidence contract.
      for (const ins of scenario.expectedInsufficient) {
        const hit = result.insufficientEvidence.some(
          (h) => h.rule === ins.kind && h.merchantKey === ins.key,
        );
        if (!hit) {
          problems.push(
            `missing insufficient-evidence record for ${ins.kind} (${ins.key})`,
          );
        }
      }

      if (problems.length > 0) {
        errors.push(`\n[${scenario.name}]\n  ${problems.join("\n  ")}`);
        expect(problems, scenario.name).toEqual([]);
      } else {
        // Print honest rows for the report even on pass.
        const ins = result.insufficientEvidence
          .map((h) => `${h.merchantKey}:${h.category === "identity_uncertain" ? "identity?" : "window"}`)
          .join(", ");
        sheet.push(
          `${scenario.name} | ${emittedKeys.length === 0 ? "none" : emittedKeys.join(", ")}` +
            ` | suppressed=${result.insufficientEvidence.length}${ins ? ` [${ins}]` : ""}`,
        );
      }
    });
  }

  it(`aggregates measured precision/recall across ${SCENARIO_COUNT} scenarios`, async () => {
    if (errors.length > 0) {
      expect.fail(`ground-truth failures:\n${errors.join("\n")}`);
    }
    const precision = total.tp === 0 ? 1 : total.tp / (total.tp + total.fp);
    const recall = total.tp === 0 ? 1 : total.tp / (total.tp + total.fn);
    if (DUMP_PATH) {
      const fs = await import("node:fs");
      fs.writeFileSync(
        DUMP_PATH,
        JSON.stringify(
          {
            scenarios: total.scenarios,
            tp: total.tp,
            fp: total.fp,
            fn: total.fn,
            precision,
            recall,
            suppressedInsufficient: total.suppressedObservation,
            suppressedIdentity: total.suppressedIdentity,
            sheet,
          },
          null,
          2,
        ),
      );
    }
    console.log(
      `aggregate: scenarios=${total.scenarios} tp=${total.tp} fp=${total.fp} fn=${total.fn}` +
        ` precision=${precision.toFixed(3)} recall=${recall.toFixed(3)}` +
        ` suppressed_insufficient=${total.suppressedObservation} suppressed_identity=${total.suppressedIdentity}`,
    );
    expect(total.fp).toBe(0);
    expect(total.fn).toBe(0);
  });
});

function confidenceAtLeast(
  actual: "high" | "medium" | "low",
  floor: "high" | "medium" | "low",
): boolean {
  const rank = { high: 3, medium: 2, low: 1 };
  return rank[actual] >= rank[floor];
}