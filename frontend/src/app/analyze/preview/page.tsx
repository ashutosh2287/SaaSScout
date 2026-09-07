"use client";

import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { BrandMark } from "@/components/layout/BrandMark";
import { DashboardMetrics } from "@/components/analyze/DashboardMetrics";
import { ReviewQueue } from "@/components/analyze/ReviewQueue";
import { SoftwareBreakdown } from "@/components/analyze/SoftwareBreakdown";
import { DataQualityCard } from "@/components/analyze/DataQualityCard";
import { RecurringCard } from "@/components/analyze/RecurringCard";
import { ExportCard } from "@/components/analyze/ExportCard";
import { SaveAnalysisCard } from "@/components/analyze/SaveAnalysisCard";
import { CrossSourceBreakdown } from "@/components/analyze/CrossSourceBreakdown";
import { useMerchantDetail } from "@/components/analyze/MerchantDetailView";
import { categoryLabel, categoryTone } from "@/components/analyze/classificationLabels";
import { intervalLabel, statusLabel, statusTone } from "@/components/analyze/recurringLabels";
import { classifyMerchants } from "@/lib/classification";
import { detectRecurring } from "@/lib/recurring";
import { getParseResult } from "@/lib/parse/store";
import { isCurrencySymbol } from "@/lib/parse/currency";
import { summarizeParseErrors } from "@/lib/parse/errors";
import { normalizeMerchants } from "@/lib/merchant";
import { inspectDataQuality } from "@/lib/quality";
import { aggregateSoftwareSpend } from "@/lib/software";
import { detectSpendReviews } from "@/lib/leak";
import { buildReport } from "@/lib/report";
import { deriveDashboard, reviewFromSpendReview, rowFromSoftwareMerchant } from "@/lib/dashboard";
import { deriveSourceBreakdown } from "@/lib/dashboard/source-breakdown";

const PREVIEW_ROWS = 20;

function fmtAmount(n: number, currency?: string | null): string {
  const abs = Math.abs(n);
  const symbol = isCurrencySymbol(currency) ? currency : "$";
  return (n < 0 ? "-" + symbol : symbol) + abs.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function PreviewPage() {
  const result = getParseResult();

  if (!result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-24">
        <Container className="max-w-md">
          <EmptyState
            icon={
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            }
            title="No file selected."
            description="Select a CSV or XLSX file to see its preview."
            action={
              <Link href="/analyze" className={buttonClasses("primary", "md")}>
                Choose a file
              </Link>
            }
          />
        </Container>
      </div>
    );
  }

  return <PreviewContent result={result} />;
}

// Runs the full client-side analysis for a parsed file. Owns the merchant
// drill-down state so the ReviewQueue and SoftwareBreakdown share one panel.
function PreviewContent({
  result,
}: {
  result: NonNullable<ReturnType<typeof getParseResult>>;
}) {
  const { file, transactions, totalRows, parsedRows, errors, columnDiagnostics } = result;
  const attentionCount = errors.length;
  const preview = transactions.slice(0, PREVIEW_ROWS);
  const quality = inspectDataQuality(result.transactions);
  const merchantResult = normalizeMerchants(result.transactions);
  const classificationResult = classifyMerchants(merchantResult.merchants);
  const recurringResult = detectRecurring(merchantResult.transactions);
  const softwareResult = aggregateSoftwareSpend(
    merchantResult.transactions,
    classificationResult.merchants,
    recurringResult.patterns,
  );
  const reviewResult = detectSpendReviews(softwareResult.merchants, quality, result.currency);
  const report = buildReport({
    parse: result,
    quality,
    classification: classificationResult,
    recurring: recurringResult,
    software: softwareResult,
    review: reviewResult,
  });
  const merchantDetail = useMerchantDetail(report);
  const merchantById = new Map(
    merchantResult.transactions.map((t) => [t.id, t.merchant.canonicalName]),
  );
  const merchantKeyById = new Map(
    merchantResult.transactions.map((t) => [t.id, t.merchant.normalizedKey]),
  );
  const classificationByKey = new Map(
    classificationResult.merchants.map((m) => [m.normalizedKey, m]),
  );

  const view = deriveDashboard({
    rows: softwareResult.merchants.map(rowFromSoftwareMerchant),
    softwareSpend: softwareResult.summary,
    review: reviewResult.summary,
    qualityReadiness: quality.analysisReadiness,
    reviews: reviewResult.reviews,
  });
  const queueItems = reviewResult.reviews.map(reviewFromSpendReview);
  const blocked = quality.analysisReadiness === "blocked";

  // Step 28 — cross-source attribution. Only meaningful when the user
  // uploaded more than one file (the parser tags transactions with a
  // source label) and the engine found software merchants to split.
  const sourceLabels = (result.sources ?? []).map((s) => s.label);
  const crossSource = deriveSourceBreakdown(report, result.transactions, sourceLabels);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <Container className="flex h-16 items-center justify-between">
          <BrandMark />
          <Link
            href="/analyze"
            className="text-sm font-medium text-ink-2 transition-colors hover:text-ink"
          >
            Choose a different file
          </Link>
        </Container>
      </header>

      <main className="px-6 py-12 sm:py-16">
        <Container className="max-w-5xl">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              Your file is ready for analysis.
            </h1>
            <p className="mt-3 text-zinc-600">
              <span className="font-medium text-zinc-900">{file.name}</span> — no analysis has been
              run yet.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-surface px-5 py-4 shadow-sm">
               <p className="font-mono text-[11px] text-ink-3">rows found</p>
               <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{totalRows.toLocaleString()}</p>
             </div>
             <div className="rounded-xl border border-zinc-200 bg-surface px-5 py-4 shadow-sm">
               <p className="font-mono text-[11px] text-ink-3">transactions parsed</p>
               <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-700">{parsedRows.toLocaleString()}</p>
             </div>
             <div className="rounded-xl border border-zinc-200 bg-surface px-5 py-4 shadow-sm">
               <p className="font-mono text-[11px] text-ink-3">skipped</p>
               <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{result.skippedRows.toLocaleString()}</p>
             </div>
             <div className="rounded-xl border border-zinc-200 bg-surface px-5 py-4 shadow-sm">
               <p className="font-mono text-[11px] text-ink-3">need attention</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-amber-700">{attentionCount.toLocaleString()}</p>
            </div>
          </div>

          {attentionCount > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <h2 className="text-sm font-semibold text-amber-900">
                {attentionCount} transaction{attentionCount === 1 ? "" : "s"} skipped
              </h2>
              <ul className="mt-3 space-y-3">
                {summarizeParseErrors(errors).map((s) => (
                  <li key={s.code}>
                    <p className="text-sm font-medium text-amber-900">
                      {s.label} · {s.count}
                    </p>
                    <p className="text-sm text-amber-800">{s.hint}</p>
                    {s.sampleRows.length > 0 && (
                      <p className="text-xs text-amber-700">
                        Rows: {s.sampleRows.join(", ")}
                        {s.count > s.sampleRows.length ? ", …" : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8">
            <DashboardMetrics metrics={view.metrics} currency={result.currency} />
          </div>

          <CrossSourceBreakdown breakdown={crossSource} currency={result.currency} />

          <div className="mt-4">
            <ReviewQueue
              reviews={queueItems}
              blocked={blocked}
              strongReviewCount={reviewResult.summary.strongReviewCount}
              reviewCount={reviewResult.summary.reviewCount}
              onInspect={merchantDetail.inspect}
              currency={result.currency}
            />
          </div>

          {merchantDetail.panel && <div className="mt-4">{merchantDetail.panel}</div>}

          <div className="mt-4">
            <RecurringCard s={recurringResult.summary} />
          </div>

          <SoftwareBreakdown rows={view.softwareRows} onInspect={merchantDetail.inspect} currency={result.currency} />

          <div className="mt-4">
            <DataQualityCard q={quality} />
          </div>

          {columnDiagnostics.missing.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Column not detected: {columnDiagnostics.missing.join(", ")}. Rows affected by this are
              flagged in the review below.
            </div>
          )}
          {columnDiagnostics.ambiguous.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Ambiguous columns: {columnDiagnostics.ambiguous.join(", ")}. Interpreted as
              debit (negative) / credit (positive).
            </div>
          )}

          <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900">
                Preview {parsedRows > 0 ? "· first " + preview.length : ""}
              </h2>
            </div>
            {preview.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-zinc-500">
                No transactions were parsed from this file.
              </p>
            ) : (
              <div className="overflow-x-auto" tabIndex={0}>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line font-mono text-[11px] text-ink-3">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">Date</th>
                      <th scope="col" className="px-5 py-3 font-medium">Description</th>
                      <th scope="col" className="px-5 py-3 font-medium">Merchant</th>
                      <th scope="col" className="px-5 py-3 font-medium">Type</th>
                      <th scope="col" className="px-5 py-3 font-medium">Recurring</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Amount</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Row</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {preview.map((t) => (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap px-5 py-3 text-zinc-600">{t.date ?? "—"}</td>
                        <td className="px-5 py-3 text-zinc-900">{t.description}</td>
<td className="px-5 py-3 text-zinc-600">
                          {merchantById.get(t.id) ?? <span className="text-zinc-500">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          {(() => {
                            const key = merchantKeyById.get(t.id);
                            if (!key) return <span className="text-zinc-500">—</span>;
                            const cm = classificationByKey.get(key);
                            if (!cm) return <span className="text-zinc-500">—</span>;
                            return (
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${categoryTone[cm.classification.category]}`}
                              >
                                {categoryLabel[cm.classification.category]}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-3">
                          {(() => {
                            const key = merchantKeyById.get(t.id);
                            if (!key) return <span className="text-zinc-500">—</span>;
                            const r = recurringResult.patterns.get(key);
                            if (!r) return <span className="text-zinc-500">—</span>;
                            const showInterval =
                              r.status !== "insufficient_data" &&
                              r.status !== "not_recurring" &&
                              r.interval !== null &&
                              r.interval !== "irregular";
                            return (
                              <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[r.status]}`}>
                                {statusLabel[r.status]}
                                {showInterval && r.interval !== null && r.interval !== "irregular"
                                  ? ` · ${intervalLabel[r.interval]}`
                                  : ""}
                              </span>
                            );
                          })()}
                        </td>
                        <td className={`whitespace-nowrap px-5 py-3 text-right tabular-nums ${t.amount < 0 ? "text-red-600" : "text-zinc-900"}`}>
                          {fmtAmount(t.amount, result.currency)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-zinc-500">{t.sourceRow}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-zinc-500">
            Showing the first {preview.length} of {parsedRows.toLocaleString()} parsed transactions.
            Classifications and recurring patterns are likely labels, not guaranteed facts. Nothing
            has been uploaded — this all stays in your browser.
          </p>

          <div className="mt-4">
            <ExportCard report={report} />
          </div>

          <div className="mt-4">
            <SaveAnalysisCard report={report} />
          </div>
        </Container>
      </main>
    </div>
  );
}