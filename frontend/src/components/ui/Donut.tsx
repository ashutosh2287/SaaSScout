interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}

export function Donut({ segments, size = 120, strokeWidth = 12 }: DonutProps) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = 2;

  const built: { label: string; dasharray: string; dashoffset: number; color: string }[] = [];
  let offset = 0;
  for (const d of segments) {
    const length = total === 0 ? 0 : (d.value / total) * circumference;
    const dasharray = `${Math.max(0, length - gap)} ${circumference}`;
    const dashoffset = -offset;
    offset += length;
    built.push({
      label: d.label,
      dasharray,
      dashoffset,
      color: d.color ?? "var(--color-ink)",
    });
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
          />
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
