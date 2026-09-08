import type { DataQualityDiagnostics } from "@/lib/quality/types";

const levelTone: Record<string, string> = {
  Good: "bg-emerald-50 text-emerald-700",
  Fair: "bg-amber-50 text-amber-700",
  "Needs attention": "bg-red-50 text-red-700",
};

const readinessLabel: Record<string, string> = {
  ready: "Ready to analyze",
  needs_attention: "Needs attention before analysis",
  blocked: "Not usable for analysis",
};

export function DataQualityCard({ q }: { q: DataQualityDiagnostics }) {
  return (
    <div className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">Data quality</h2>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${levelTone[q.level]}`}>
            {q.level}
          </span>
          <span className="text-lg font-semibold tabular-nums text-zinc-900">
            {q.score}<span className="text-sm font-normal text-zinc-500">/100</span>
          </span>
        </div>
      </div>

      <div className="px-5 py-4">
        <ul className="space-y-2 text-sm">
          <QualityRow label="dates" value={`${q.date.present.toLocaleString()} present · ${q.date.missing.toLocaleString()} missing`} ok={q.date.missing === 0 || q.date.present >= (q.date.present + q.date.missing) * 0.9} />
          <QualityRow
            label="analyzed window"
            value={q.date.earliest && q.date.latest ? `${q.date.earliest} to ${q.date.latest}` : "No usable dates"}
            ok={Boolean(q.date.earliest && q.date.latest)}
          />
          <QualityRow label="descriptions" value={`${q.description.missing.toLocaleString()} missing · ${q.description.lowInformation.toLocaleString()} low-information`} ok={q.description.missing === 0} />
          <QualityRow label="amounts" value={`${q.amount.positive.toLocaleString()} positive · ${q.amount.negative.toLocaleString()} negative · ${q.amount.zero.toLocaleString()} zero`} ok={true} />
          <QualityRow label="coverage" value={`${q.coverage.dateRangeDays?.toLocaleString() ?? "—"} days${q.coverage.dateRangeDays ? ` · ${q.coverage.monthsRepresented} months` : ""}`} ok={Boolean(q.coverage.dateRangeDays)} />
        </ul>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3">
          <span className="text-sm font-medium text-zinc-700">Analysis readiness</span>
          <span className="text-sm font-semibold text-zinc-900">{readinessLabel[q.analysisReadiness]}</span>
        </div>

        {q.warnings.length > 0 && (
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <p className="font-mono text-[11px] text-ink-3">
              {q.warnings.length} check{q.warnings.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-2 space-y-1.5">
              {q.warnings.map((w) => (
                <li key={w.code} className="flex items-start gap-2 text-sm text-zinc-600">
                  <WarningGlyph severity={w.severity} />
                  <span>
                    <span className="sr-only">{w.severity}: </span>
                    {w.code === "EXACT_DUPLICATES"
                      ? `${w.count} exact duplicate(s) detected`
                      : w.code === "POSSIBLE_DUPLICATES"
                        ? `${w.count} possible duplicate(s)`
                        : w.message}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function QualityRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 font-mono text-[11px] text-ink-3 lowercase">
        <span aria-hidden="true" className={`text-xs ${ok ? "text-emerald-700" : "text-amber-700"}`}>
          {ok ? "✓" : "⚠"}
        </span>
        {label}
      </span>
      <span className="text-right text-xs text-zinc-500">{value}</span>
    </li>
  );
}

function WarningGlyph({ severity }: { severity: "info" | "warning" | "critical" }) {
  const cls = severity === "critical" ? "text-red-600" : severity === "warning" ? "text-amber-700" : "text-zinc-500";
  return (
    <span aria-hidden="true" className={`shrink-0 ${cls}`}>
      {severity === "info" ? "•" : severity === "warning" ? "⚠" : "⛔"}
    </span>
  );
}