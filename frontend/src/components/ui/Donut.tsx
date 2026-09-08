interface DonutSegment {
  label: string;
  value: number;
  color?: string;
  /** Optional per-segment detail, e.g. "$4,820/mo". */
  detail?: string;
}

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}

// Step D4 — pure-SVG donut, no chart library. Honesty rules:
//   - Segment length is proportional to value/total, never inflated.
//   - Zero-value segments are skipped entirely (a 0-length arc is
//     invisible and reads as "no data", not "zero").
//   - Empty input renders an honest "no data" center rather than a
//     donut with a 0 total and a legend of zero-width swatches.
//   - Native `title` tooltips on hover — no tooltip library.
export function Donut({ segments, size = 120, strokeWidth = 12 }: DonutProps) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = 2;

  const built: { label: string; dasharray: string; dashoffset: number; color: string; detail?: string }[] = [];
  let offset = 0;
  for (const d of segments) {
    if (d.value <= 0) continue;
    const length = (d.value / total) * circumference;
    const dasharray = `${Math.max(0, length - gap)} ${circumference}`;
    const dashoffset = -offset;
    offset += length;
    built.push({
      label: d.label,
      dasharray,
      dashoffset,
      color: d.color ?? "var(--color-ink)",
      detail: d.detail,
    });
  }

  if (built.length === 0) {
    return (
      <div className="flex items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={strokeWidth}
          />
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="font-mono text-[11px] fill-ink-3"
          >
            no data
          </text>
        </svg>
        <p className="font-mono text-[11px] text-ink-3">no data to chart</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={strokeWidth}
        />
        {built.map((p, i) => (
<circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={p.color}
              strokeWidth={strokeWidth}
              strokeDasharray={p.dasharray}
              strokeDashoffset={p.dashoffset}
              strokeLinecap="butt"
              className="transition-colors hover:opacity-80"
            >
              <title>{`${p.label}: ${segments[i].value.toLocaleString()}${p.detail ? ` (${p.detail})` : ""}`}</title>
            </circle>
        ))}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-mono text-[11px] fill-ink-3"
        >
          {total.toLocaleString()}
        </text>
      </svg>
      <div className="space-y-1">
        {built.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span className="font-mono text-[11px] text-ink-3 lowercase">{p.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-ink">{segments[i].value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
