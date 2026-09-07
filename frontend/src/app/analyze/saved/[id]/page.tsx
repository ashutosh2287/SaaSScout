"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { BrandMark } from "@/components/layout/BrandMark";
import { SavedReportView } from "@/components/analyze/SavedReportView";
import { getAnalysis, isReadableSavedAnalysis, PersistenceError, schemaCompatible } from "@/lib/persistence";
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
        } else if (!isReadableSavedAnalysis(saved)) {
          setState({
            kind: "error",
            message: "This saved analysis is corrupted and can't be displayed on this device.",
          });
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
      <div className="min-h-screen bg-canvas">
        <header className="border-b border-line bg-surface">
          <Container className="flex h-16 items-center justify-between">
            <BrandMark />
            <Link href="/analyze/saved" className="text-sm font-medium text-ink-2 transition-colors hover:text-ink">
              Saved analyses
            </Link>
          </Container>
        </header>
        <main className="px-6 py-16">
          <Container className="max-w-3xl text-center">
            {state.kind === "loading" && (
              <p role="status" className="text-sm text-ink-3">Loading saved analysis…</p>
            )}
            {state.kind === "missing" && (
              <>
                <h1 className="text-2xl font-semibold tracking-tight text-ink">Analysis not found</h1>
                <p className="mt-3 text-ink-2">This saved analysis could not be found on this device.</p>
                <Link href="/analyze/saved" className={`mt-6 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink shadow-card transition-colors hover:bg-brand-hover`}>
                  Back to saved analyses
                </Link>
              </>
            )}
            {state.kind === "incompatible" && (
              <>
                <h1 className="text-2xl font-semibold tracking-tight text-ink">Can&apos;t open this analysis</h1>
                <p className="mt-3 text-ink-2">
                  This saved analysis was created with an older version of Sasscout and can&apos;t be opened.
                </p>
                <Link href="/analyze/saved" className={`mt-6 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink shadow-card transition-colors hover:bg-brand-hover`}>
                  Back to saved analyses
                </Link>
              </>
            )}
            {state.kind === "error" && (
              <p role="status" className="text-sm text-ink-2">{state.message}</p>
            )}
          </Container>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <Container className="flex h-16 items-center justify-between">
          <BrandMark />
          <Link href="/analyze/saved" className="text-sm font-medium text-ink-2 transition-colors hover:text-ink">
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
