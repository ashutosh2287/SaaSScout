"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Container } from "@/components/ui/Container";
import { UploadZone } from "@/components/analyze/UploadZone";
import { SelectedFile } from "@/components/analyze/SelectedFile";
import { validateFile, formatFileSize, MAX_FILE_SIZE } from "@/lib/validateFile";
import { parseFile } from "@/lib/parse";
import { setParseResult } from "@/lib/parse/store";

type Phase = "idle" | "selected" | "parsing";

export default function AnalyzePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  function handleFile(next: File) {
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
    setFile(null);
    setPhase("idle");
    setError(null);
  }

  async function handleContinue() {
    if (!file || phase !== "selected") return;
    setPhase("parsing");
    setError(null);
    try {
      const result = await parseFile(file);
      setParseResult(result);
      router.push("/analyze/preview");
    } catch (err) {
      setPhase("selected");
      setError(err instanceof Error ? err.message : "Could not read this file.");
    }
  }

  const busy = phase === "parsing";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
              S
            </span>
            <span className="text-lg font-semibold tracking-tight text-zinc-900">Sasscout</span>
          </Link>
          <Link
            href="/"
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
                    className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600"
                  >
                    <svg
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin text-emerald-700 motion-reduce:animate-none"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                    </svg>
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

      <div className="border-t border-zinc-200 bg-white">
        <Container className="flex items-center justify-end py-6">
          <button
            type="button"
            disabled={phase !== "selected"}
            onClick={handleContinue}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {busy ? "Reading…" : "Continue"}
          </button>
        </Container>
      </div>
    </div>
  );
}