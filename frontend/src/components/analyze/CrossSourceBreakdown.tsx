"use client";

import { type SourceBreakdown } from "@/lib/dashboard/source-breakdown";

// Step 28 — cross-source software spend breakdown panel.
//
// Renders only when isMultiSource is true (the user uploaded more than
// one file and the engine identified any software spend). When the panel
// is suppressed the rest of the preview is unchanged: the single-file
// path has no second-slot to talk about.
//
// Visual contract (matches the rest of the dashboard's ledger style):
//   - hairline border, no shadow, no rounded-2xl
//   - mono annotation line, serif body
//   - tabular-nums on money, right-aligned column
import { isCurrencySymbol } from "@/lib/parse/currency";

function fmtAmount(n: number, currency: string | null | undefined): string {
  const symbol = isCurrencySymbol(currency) ? currency : "$";
  return symbol + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function CrossSourceBreakdown({
  breakdown,
  currency,
}: {
  breakdown: SourceBreakdown;
  currency: string | null | undefined;
}) {
  if (!breakdown.isMultiSource || breakdown.bySource.length < 2) return null;

  return (
    <section
      aria-labelledby="cross-source-heading"
      className="mt-4 border border-line bg-surface"
    >
      <header className="flex items-baseline justify-between border-b border-line px-5 py-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
            02 · cross-source
          </p>
          <h2 id="cross-source-heading" className="font-display text-xl text-ink">
            Where your software spend came from
          </h2>
        </div>
        <p className="font-mono text-[11px] text-ink-3">
          est. {fmtAmount(breakdown.totalIdentifiedSoftwareSpend, currency)}/yr
        </p>
      </header>
      <div className="px-5 py-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="font-mono text-[11px] text-ink-3">
              <th scope="col" className="py-2 pr-4 font-medium">source</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium tabular-nums">amount</th>
              <th scope="col" className="py-2 text-right font-medium tabular-nums">share</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.bySource.map((e) => (
              <tr key={e.label} className="border-t border-line">
                <td className="py-2 pr-4 text-ink-2">
                  {e.label === "(unspecified)" ? (
                    <span className="font-mono text-xs italic text-ink-3">
                      (unspecified)
                    </span>
                  ) : (
                    e.label
                  )}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-ink-2">
                  {fmtAmount(e.amount, currency)}
                </td>
                <td className="py-2 text-right tabular-nums text-ink">
                  {e.sharePercent}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 font-mono text-[11px] text-ink-3">
          percent rounded to whole; column sums to 100.
        </p>
      </div>
    </section>
  );
}
