"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { deleteAnalysis, listAnalyses, PersistenceError } from "@/lib/persistence";
import { schemaCompatible } from "@/lib/persistence";
import type { SavedAnalysis } from "@/lib/persistence/types";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; items: SavedAnalysis[] }
  | { kind: "error"; message: string };

function formatDate(value: unknown): string {
  if (typeof value !== "string") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function displayName(value: unknown): string {
  return typeof value === "string" ? value : "Unnamed analysis";
}

export default function SavedAnalysesPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchList = useCallback(() => {
    listAnalyses()
      .then((items) => setState({ kind: "loaded", items }))
      .catch((e) =>
        setState({
          kind: "error",
          message: e instanceof PersistenceError ? e.message : "Could not load saved analyses on this device.",
        }),
      );
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Reload after delete: reset to loading (safe from an event handler).
  const reload = () => {
    setState({ kind: "loading" });
    fetchList();
  };

  async function handleDelete(id: string) {
    try {
      await deleteAnalysis(id);
      setConfirmDelete(null);
      reload();
    } catch {
      setState({ kind: "error", message: "We couldn't delete this analysis on this device." });
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">S</span>
            <span className="text-lg font-semibold tracking-tight text-zinc-900">Sasscout</span>
          </Link>
          <Link href="/analyze" className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900">
            Analyze a file
          </Link>
        </Container>
      </header>

      <main className="px-6 py-12 sm:py-16">
        <Container className="max-w-3xl">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">Saved analyses</h1>
            <p className="mt-3 text-zinc-600">Analyses saved privately on this device. Nothing is uploaded.</p>
            {state.kind === "loaded" && state.items.length >= 2 && (
              <Link
                href="/analyze/compare"
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50"
              >
                Compare two periods
              </Link>
            )}
          </div>

          <div className="mt-8">
            {state.kind === "loading" && (
              <div
                role="status"
                className="rounded-2xl border border-zinc-200 bg-white px-5 py-12 text-center text-sm text-zinc-500 shadow-sm"
              >
                Loading saved analyses…
              </div>
            )}

            {state.kind === "error" && (
              <div
                role="status"
                className="rounded-2xl border border-zinc-200 bg-white px-5 py-12 text-center text-sm text-zinc-600 shadow-sm"
              >
                {state.message}
              </div>
            )}

            {state.kind === "loaded" && state.items.length === 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-12 text-center shadow-sm">
                <p className="text-sm font-medium text-zinc-700">No saved analyses yet.</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Analyze your spending and save a report to see it here.
                </p>
                <Link
                  href="/analyze"
                  className="mt-5 inline-flex items-center justify-center rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
                >
                  Analyze a file
                </Link>
              </div>
            )}

            {state.kind === "loaded" && state.items.length > 0 && (
              <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                {state.items.map((item) => {
                  const compatible = schemaCompatible(item);
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900">{displayName(item.name)}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {typeof item.fileName === "string" ? item.fileName : ""} · Saved {formatDate(item.updatedAt)}
                        </p>
                        {!compatible && (
                          <p className="mt-1 text-xs text-amber-700">
                            This saved analysis was created with an older version of Sasscout and can&apos;t be opened.
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {compatible && (
                          <Link
                            href={`/analyze/saved/${item.id}`}
                            className="rounded-lg border border-zinc-200 px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                          >
                            Open
                          </Link>
                        )}
                        {confirmDelete === item.id ? (
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">Delete?</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(item.id)}
                            className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Container>
      </main>
    </div>
  );
}
