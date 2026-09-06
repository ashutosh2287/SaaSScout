"use client";

import { useEffect, useMemo, useState } from "react";
import { listAnalyses, PersistenceError, schemaCompatible } from "@/lib/persistence";
import type { SavedAnalysis } from "@/lib/persistence/types";
import { compareReports } from "@/lib/compare/engine";
import type { ComparisonResult } from "@/lib/compare/types";
import { KIND_LABEL, confidenceLabel, impactLine, windowText } from "@/lib/compare/format";

type PanelState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: SavedAnalysis[] };

function shortName(saved: SavedAnalysis): string {
  return saved.name.length > 48 ? `${saved.name.slice(0, 48)}…` : saved.name;
}

export function ComparePanel() {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [baselineId, setBaselineId] = useState("");
  const [currentId, setCurrentId] = useState("");
  const [result, setResult] = useState<ComparisonResult | null>(null);

  useEffect(() => {
    listAnalyses()
      .then((items) => setState({ kind: "ready", items }))
      .catch((e) =>
        setState({
          kind: "error",
          message: e instanceof PersistenceError ? e.message : "Could not load saved analyses on this device.",
        }),
      );
  }, []);

  const { baseline, current } = useMemo(() => {
    if (state.kind !== "ready") return { baseline: null, current: null };
    return {
      baseline: state.items.find((i) => i.id === baselineId) ?? null,
      current: state.items.find((i) => i.id === currentId) ?? null,
    };
  }, [state, baselineId, currentId]);

  function runCompare() {
    if (!baseline || !current) return;
    setResult(
      compareReports(baseline.report, current.report, {
        baseline: labelOf(baseline),
        current: labelOf(current),
      }),
    );
  }

  const selectable =
    state.kind === "ready" ? state.items.filter((i) => schemaCompatible(i)) : [];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      {state.kind === "loading" && (
        <p role="status" className="text-sm text-zinc-500">
          Loading saved analyses…
        </p>
      )}
      {state.kind === "error" && (
        <p role="status" className="text-sm text-zinc-600">
          {state.message}
        </p>
      )}
      {state.kind === "ready" && selectable.length < 2 && (
        <div>
          <p className="text-sm font-medium text-zinc-700">Compare two analyses</p>
          <p className="mt-2 text-sm text-zinc-500">
            Save and reopen two analyses from different periods, then pick them here to see what changed in your
            software and recurring spend between the two periods. Everything stays on this device.
          </p>
          <p className="mt-4 text-sm text-zinc-500">
            {selectable.length === 0
              ? "You have no saved analyses yet."
              : "You need at least two saved analyses to compare."}
          </p>
        </div>
      )}

      {state.kind === "ready" && selectable.length >= 2 && (
        <div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="block flex-1">
              <span className="text-sm font-medium text-zinc-700">Earlier period</span>
              <select
                value={baselineId}
                onChange={(e) => {
                  setBaselineId(e.target.value);
                  setResult(null);
                }}
                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="">Select an analysis…</option>
                {selectable.map((i) => (
                  <option key={i.id} value={i.id}>
                    {shortName(i)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="text-sm font-medium text-zinc-700">Current period</span>
              <select
                value={currentId}
                onChange={(e) => {
                  setCurrentId(e.target.value);
                  setResult(null);
                }}
                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="">Select an analysis…</option>
                {selectable.map((i) => (
                  <option key={i.id} value={i.id}>
                    {shortName(i)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!baseline || !current || baseline.id === current.id}
              onClick={runCompare}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Compare
            </button>
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            Pick the earlier and the more recent analysis. If an analysis is out of date, re-analyze that period&apos;s
            file and save again before comparing.
          </p>

          {result && <ResultView result={result} currency={current?.report.currency ?? null} />}
        </div>
      )}
    </div>
  );
}

function labelOf(saved: SavedAnalysis): string {
  const w = { start: saved.report.quality.date?.earliest ?? null, end: saved.report.quality.date?.latest ?? null };
  return `${saved.name} (${windowText(w)})`;
}

function ResultView({ result, currency }: { result: ComparisonResult; currency?: string | null }) {
  return (
    <div className="mt-8">
      {result.caution && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {result.caution}
        </div>
      )}

      <div className="mb-6 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Earlier period</p>
          <p className="mt-1 text-zinc-700">{result.baseline.label}</p>
          <p className="text-xs text-zinc-500">{windowText(result.baseline.window)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Current period</p>
          <p className="mt-1 text-zinc-700">{result.current.label}</p>
          <p className="text-xs text-zinc-500">{windowText(result.current.window)}</p>
        </div>
      </div>

      {result.findings.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-zinc-700">No material changes detected</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-zinc-500">
            No software merchant moved enough to report between these two periods: no material price or frequency
            step, and no qualifying new or ended recurring charges. A quiet period is a genuine result.
          </p>
        </div>
      )}

      {result.findings.length > 0 && (
        <ul className="space-y-4">
          {result.findings.map((f) => (
            <li key={`${f.kind}:${f.merchantKey}`} className="rounded-xl border border-zinc-200 px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">
                  {KIND_LABEL[f.kind]}
                  <span className="ml-2 font-normal text-zinc-500">— {f.merchantName}</span>
                </p>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                  {confidenceLabel(f.confidence)}
                </span>
              </div>
              {impactLine(f, currency) && <p className="mt-2 text-sm font-medium text-zinc-700">{impactLine(f, currency)}</p>}
              <ul className="mt-3 space-y-1.5">
                {f.evidence.map((e, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-600">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-300" />
                    <span>{e.message}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {result.insufficientEvidence.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900">Not enough evidence to tell</h2>
          <p className="mt-1 text-sm text-zinc-500">
            These hypotheses were considered and deliberately not reported: the windows or patterns could not prove
            them. Absence of evidence is not proof of a change.
          </p>
          <ul className="mt-3 space-y-2">
            {result.insufficientEvidence.map((h, i) => (
              <li key={i} className="rounded-lg border border-dashed border-zinc-300 px-4 py-3">
                <p className="text-sm font-medium text-zinc-700">
                  {h.merchantName} — {KIND_LABEL[h.rule]}
                </p>
                <p className="mt-1 text-sm text-zinc-500">{h.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}