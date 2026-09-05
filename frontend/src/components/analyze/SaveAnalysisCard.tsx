"use client";

import { useState } from "react";
import Link from "next/link";
import type { SasscoutReport } from "@/lib/report/types";
import { createSavedAnalysis, saveAnalysis, PersistenceError } from "@/lib/persistence";
import { createSingleFlight } from "@/lib/lifecycle/singleflight";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; id: string }
  | { kind: "error"; message: string };

export function SaveAnalysisCard({ report }: { report: SasscoutReport }) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  // Double-fired Save in the same tick must still write exactly one record:
  // `state` updates are async, so the disabled button alone cannot stop it.
  const [flight] = useState(createSingleFlight);

  async function handleSave() {
    const token = flight.start();
    if (token === null) return; // a save is already in flight
    setState({ kind: "saving" });
    const analysis = createSavedAnalysis(report);
    try {
      await saveAnalysis(analysis);
      setState({ kind: "saved", id: analysis.id });
    } catch (e) {
      setState({
        kind: "error",
        message:
          e instanceof PersistenceError
            ? e.message
            : "We couldn't save this analysis on this device. Your current analysis is still available.",
      });
    } finally {
      flight.end(token);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">Save this analysis</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Keep this report privately on this device so you can reopen it later.
        </p>
      </div>
      <div className="space-y-3 px-5 py-4">
        {state.kind === "saved" ? (
          <div role="status" className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              ✓ Analysis saved locally on this device
            </span>
            <Link
              href={`/analyze/saved/${state.id}`}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Open saved analysis
            </Link>
          </div>
        ) : state.kind === "error" ? (
          <div role="status">
            <p className="text-sm text-zinc-700">{state.message}</p>
            <button
              type="button"
              onClick={handleSave}
              className="mt-2 rounded-lg border border-zinc-200 px-3.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Try again
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={state.kind === "saving"}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:opacity-60"
          >
            {state.kind === "saving" ? "Saving…" : "Save analysis"}
          </button>
        )}

        <p className="text-xs text-zinc-500">
          Saved privately on this device. Your original file is never uploaded.
        </p>
        <Link href="/analyze/saved" className="inline-block text-sm font-medium text-zinc-600 hover:text-zinc-900">
          View saved analyses
        </Link>
      </div>
    </div>
  );
}
