"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { BrandMark } from "@/components/layout/BrandMark";
import { UploadZone } from "@/components/analyze/UploadZone";
import { SelectedFile } from "@/components/analyze/SelectedFile";
import { validateFile, formatFileSize, MAX_FILE_SIZE } from "@/lib/validateFile";
import { parseFiles } from "@/lib/parse";
import { setParseResult } from "@/lib/parse/store";
import { createSingleFlight } from "@/lib/lifecycle/singleflight";

type Phase = "idle" | "selected" | "parsing";

// Step 28 — multi-source upload. The user can add an optional second
// statement (e.g. a different account or card). At most 2 files are
// supported in v1; a second slot keeps the UX bounded and the merge
// contract auditable.
const MAX_SOURCES = 2;

export default function AnalyzePage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  // In-flight guard for the parse+push operation. A stale completion (the user
  // replaced/removed the file or navigated away while parsing) must never
  // commit its result to the shared store nor navigate to the preview page.
  const [flight] = useState(createSingleFlight);

  useEffect(() => {
    const onPop = () => flight.invalidate();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      flight.invalidate();
    };
  }, [flight]);

  function handleFile(next: File) {
    flight.invalidate();
    const validation = validateFile(next);
    if (validation) {
      setError(validation.message);
      return;
    }
    setError(null);
    setFiles((prev) => {
      // Replace an existing file at the same "slot" — first file becomes
      // the second if the user already had one. We keep the order the user
      // chose: the first pick is the primary statement; the second is the
      // cross-source comparison.
      if (prev.length === 0) return [next];
      if (prev.length === 1) return [prev[0], next];
      return [prev[0], prev[1]]; // cap at 2
    });
    setPhase("selected");
  }

  function handleRemove(index: number) {
    flight.invalidate();
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPhase("idle");
    setError(null);
  }

  async function handleContinue() {
    if (files.length === 0 || phase !== "selected") return;
    const token = flight.start();
    if (token === null) return; // an analysis is already in flight
    setPhase("parsing");
    setError(null);
    try {
      // Single-file path: preserve the existing fast-path contract. Multi-file
      // path: tag each transaction with the file's display name.
      const entries = files.map((f) => ({ file: f, label: f.name }));
      const result = await parseFiles(entries);
      if (!flight.isCurrent(token)) return; // superseded or unmounted: stale
      setParseResult(result);
      router.push("/analyze/preview");
    } catch (err) {
      if (!flight.isCurrent(token)) return;
      setPhase("selected");
      setError(err instanceof Error ? err.message : "Could not read this file.");
    } finally {
      flight.end(token);
    }
  }

  const busy = phase === "parsing";
  const canAddMore = files.length < MAX_SOURCES;
  const showAddCta = phase === "selected" && files.length === 1 && canAddMore;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <Container className="flex h-16 items-center justify-between">
          <BrandMark onClick={() => flight.invalidate()} />
          <Link
            href="/"
            onClick={() => flight.invalidate()}
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            Back home
          </Link>
        </Container>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 py-14 sm:py-20">
        <Container className="max-w-xl">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              Analyze your software spend
            </h1>
            <p className="mt-3 text-lg leading-8 text-zinc-600">
              Upload your transaction data to get started.
            </p>
          </div>

          <div className="mt-10">
            {files.length === 0 ? (
              <>
                <UploadZone onFile={handleFile} error={error} />
                <p className="mt-4 text-center text-xs text-ink-3">
                  No data handy?{" "}
                  <a
                    href="/samples/sasscout-sample-6mo.csv"
                    download
                    className="font-medium text-ink-2 underline-offset-2 hover:underline"
                  >
                    Download a 6-month sample
                  </a>{" "}
                  to try the analyzer.
                </p>
                {error && (
                  <div
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    <svg
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M12 8v4" />
                      <path d="M12 16h.01" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-3">
                  {files.map((f, i) => (
                    <SelectedFile
                      key={`${f.name}-${i}`}
                      file={{ name: f.name, size: f.size, type: f.type }}
                      onRemove={busy ? () => {} : () => handleRemove(i)}
                    />
                  ))}
                </div>
                {showAddCta && !busy && (
                  <div className="mt-4 rounded-xl border border-dashed border-line bg-surface-muted/40 px-5 py-4">
                    <p className="text-sm text-ink-2">
                      Have a second account? Add another statement to see a cross-source breakdown.
                    </p>
                    <p className="mt-1 text-xs text-ink-3">
                      Optional — single files work the same as today.
                    </p>
                    <SecondFileInput onFile={handleFile} disabled={busy} error={error} />
                  </div>
                )}
                {phase === "parsing" && (
                  <div
                    role="status"
                    className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-2"
                  >
                    <Spinner size="md" />
                    Reading your transactions…
                  </div>
                )}
                {error && phase === "selected" && (
                  <div
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    <svg
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M12 8v4" />
                      <path d="M12 16h.01" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <p className="mt-5 text-center text-xs text-zinc-500">
            Max {formatFileSize(MAX_FILE_SIZE)} per file. Your files stay in your browser for now.
          </p>
        </Container>
      </main>

      <div className="border-t border-line bg-surface">
        <Container className="flex items-center justify-end py-6">
          <Button size="lg" disabled={phase !== "selected"} onClick={handleContinue}>
            {busy ? "Reading…" : "Continue"}
          </Button>
        </Container>
      </div>
    </div>
  );
}

function SecondFileInput({
  onFile,
  disabled,
  error,
}: {
  onFile: (file: File) => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <div className="mt-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
        <span>Add another statement</span>
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Add a second statement file"
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}