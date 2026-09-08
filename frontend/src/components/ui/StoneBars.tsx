interface BarItem {
  label: string;
  value: number;
  color?: string;
  /** Optional per-item detail line, e.g. "est. $4,820/mo". */
  detail?: string;
}

interface StoneBarsProps {
  items: BarItem[];
  max?: number;
  height?: number;
}

// Step D4 — pure-SVG bars, no chart library. Honesty rules:
//   - The bar width is proportional to value/max, never inflated.
//   - Zero-value bars render as a 1px hairline so the row still exists
//     visually (a missing bar would imply the value is absent, not zero).
//   - A `title` attribute gives a native tooltip on hover — no tooltip
//     library, no custom positioning, no z-index juggling.
//   - Empty input renders an honest "no data" row rather than a set of
//     zero-width bars with a "0" label, which would read as a chart.
export function StoneBars({ items, max, height = 12 }: StoneBarsProps) {
  const peak = max ?? Math.max(...items.map((d) => d.value), 1);
  const barWidth = 160;

  if (items.length === 0) {
    return (
      <p className="py-2 font-mono text-[11px] text-ink-3">
        no data to chart
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((d, i) => {
        const ratio = d.value / peak;
        const width = Math.max(1, ratio * barWidth);
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate font-mono text-[11px] text-ink-3 lowercase">
              {d.label}
            </span>
            <svg width={barWidth} height={height} viewBox={`0 0 ${barWidth} ${height}`} className="shrink-0">
              <rect
                x="0"
                y="0"
                width={width}
                height={height}
                fill={d.color ?? "var(--color-ink)"}
                className="transition-colors hover:opacity-80"
              >
                <title>{`${d.label}: ${d.value.toLocaleString()}${d.detail ? ` (${d.detail})` : ""}`}</title>
              </rect>
            </svg>
            <span className="min-w-0 flex-1 text-right font-mono text-[11px] tabular-nums text-ink">
              {d.value.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
