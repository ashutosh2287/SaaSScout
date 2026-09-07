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
import { parseFile } from "@/lib/parse";
import { setParseResult } from "@/lib/parse/store";
import { createSingleFlight } from "@/lib/lifecycle/singleflight";

type Phase = "idle" | "selected" | "parsing";

export default function AnalyzePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
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
      setFile(null);
      setPhase("idle");
      setError(validation.message);
      return;
    }
    setFile(next);
    setPhase("selected");
    setError(null);
  }

  function handleRemove() {
    flight.invalidate();
    setFile(null);
    setPhase("idle");
    setError(null);
  }

  async function handleContinue() {
    if (!file || phase !== "selected") return;
    const token = flight.start();
    if (token === null) return; // an analysis is already in flight
    setPhase("parsing");
    setError(null);
    try {
      const result = await parseFile(file);
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
            {phase === "idle" ? (
              <>
                <UploadZone onFile={handleFile} error={error} />
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
                <SelectedFile
                  file={{ name: file!.name, size: file!.size, type: file!.type }}
                  onRemove={busy ? () => {} : handleRemove}
                />
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
            Max {formatFileSize(MAX_FILE_SIZE)}. Your file stays in your browser for now.
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