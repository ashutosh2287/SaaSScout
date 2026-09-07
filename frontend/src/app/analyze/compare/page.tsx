"use client";

import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { BrandMark } from "@/components/layout/BrandMark";
import { ComparePanel } from "@/components/analyze/ComparePanel";

export default function ComparePage() {
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
        <Container className="max-w-4xl">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              Compare two periods
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
              Pick two saved analyses from different periods. Sasscout compares software and recurring charges
              between them: new or ended recurring charges, material price steps, and frequency changes — with the
              evidence for each claim shown, and hypotheses it cannot prove left unclaimed.
            </p>
          </div>

          <div className="mt-8">
            <ComparePanel />
          </div>
        </Container>
      </main>
    </div>
  );
}