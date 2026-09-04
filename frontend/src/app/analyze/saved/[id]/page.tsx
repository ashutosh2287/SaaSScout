"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { SavedReportView } from "@/components/analyze/SavedReportView";
import { getAnalysis, PersistenceError, schemaCompatible } from "@/lib/persistence";
import type { SavedAnalysis } from "@/lib/persistence/types";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; saved: SavedAnalysis }
  | { kind: "missing" }
  | { kind: "incompatible" }
  | { kind: "error"; message: string };

export default function SavedAnalysisPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!id) {
      Promise.resolve().then(() => setState({ kind: "missing" }));
      return;
    }
    let cancelled = false;
    getAnalysis(id)
      .then((saved) => {
        if (cancelled) return;
        if (!saved) {
          setState({ kind: "missing" });
        } else if (!schemaCompatible(saved)) {
          setState({ kind: "incompatible" });
        } else {
          setState({ kind: "loaded", saved });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: e instanceof PersistenceError ? e.message : "Could not open this saved analysis on this device.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === "loading" || state.kind === "error" || state.kind === "missing" || state.kind === "incompatible") {
    return (
      <div className="min-h-screen bg-zinc-50">
        <header className="border-b border-zinc-200 bg-white">
          <Container className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">S</span>
              <span className="text-lg font-semibold tracking-tight text-zinc-900">Sasscout</span>
            </Link>
            <Link href="/analyze/saved" className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900">
              Saved analyses
            </Link>
          </Container>
        </header>
        <main className="px-6 py-16">
          <Container className="max-w-3xl text-center">
            {state.kind === "loading" && (
              <p role="status" className="text-sm text-zinc-500">Loading saved analysis…</p>
            )}
            {state.kind === "missing" && (
              <>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Analysis not found</h1>
                <p className="mt-3 text-zinc-600">This saved analysis could not be found on this device.</p>
                <Link href="/analyze/saved" className="mt-6 inline-flex rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
                  Back to saved analyses
                </Link>
              </>
            )}
            {state.kind === "incompatible" && (
              <>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Can&apos;t open this analysis</h1>
                <p className="mt-3 text-zinc-600">
                  This saved analysis was created with an older version of Sasscout and can&apos;t be opened.
                </p>
                <Link href="/analyze/saved" className="mt-6 inline-flex rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
                  Back to saved analyses
                </Link>
              </>
            )}
            {state.kind === "error" && (
              <p role="status" className="text-sm text-zinc-600">{state.message}</p>
            )}
          </Container>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">S</span>
            <span className="text-lg font-semibold tracking-tight text-zinc-900">Sasscout</span>
          </Link>
          <Link href="/analyze/saved" className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900">
            Saved analyses
          </Link>
        </Container>
      </header>
      <main className="px-6 py-12 sm:py-16">
        <Container className="max-w-5xl">
          <SavedReportView saved={state.saved} />
        </Container>
      </main>
    </div>
  );
}
