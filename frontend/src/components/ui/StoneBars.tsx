interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface StoneBarsProps {
  items: BarItem[];
  max?: number;
  height?: number;
}

export function StoneBars({ items, max, height = 12 }: StoneBarsProps) {
  const peak = max ?? Math.max(...items.map((d) => d.value), 1);
  const barWidth = 160;

  return (
    <div className="space-y-2">
      {items.map((d, i) => {
        const ratio = d.value / peak;
        const width = Math.max(0, ratio * barWidth);
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate font-mono text-[11px] text-ink-3 lowercase">
              {d.label}
            </span>
            <svg width={barWidth} height={height} viewBox={`0 0 ${barWidth} ${height}`}>
              <rect
                x="0"
                y="0"
                width={width}
                height={height}
                fill={d.color ?? "var(--color-ink)"}
              />
            </svg>
            <span className="w-16 text-right font-mono text-[11px] tabular-nums text-ink">
              {d.value.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
