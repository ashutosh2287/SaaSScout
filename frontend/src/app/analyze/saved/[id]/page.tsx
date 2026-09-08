"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { BrandMark } from "@/components/layout/BrandMark";
import { SavedReportView } from "@/components/analyze/SavedReportView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
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
              <div role="status" className="flex flex-col items-center gap-3">
                <Spinner size="lg" />
                <p className="text-sm text-ink-3">Loading saved analysis…</p>
              </div>
            )}
            {state.kind === "missing" && (
              <EmptyState
                icon={
                  <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                }
                title="Analysis not found"
                description="This saved analysis could not be found on this device."
                action={
                  <Link href="/analyze/saved" className={buttonClasses("primary", "md")}>
                    Back to saved analyses
                  </Link>
                }
              />
            )}
            {state.kind === "incompatible" && (
              <EmptyState
                icon={
                  <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                  </svg>
                }
                title="Can&apos;t open this analysis"
                description="This saved analysis was created with an older version of Sasscout and can&apos;t be opened. Re-run the analysis from a fresh upload to get a current report."
                action={
                  <Link href="/analyze/saved" className={buttonClasses("primary", "md")}>
                    Back to saved analyses
                  </Link>
                }
              />
            )}
            {state.kind === "error" && (
              <EmptyState
                icon={
                  <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                }
                title="Could not open this analysis"
                description={state.message}
                action={
                  <Link href="/analyze" className={buttonClasses("primary", "md")}>
                    Upload a new file
                  </Link>
                }
              />
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
