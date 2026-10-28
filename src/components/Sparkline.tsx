// A tiny line chart of recent months, drawn as SVG on the server. It shows
// the shape of the trend; the exact numbers sit next to it in the table.

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <span className="text-xs text-muted">Not enough data</span>;

  const width = 120;
  const height = 32;
  const pad = 4; // room for the line's round ends and the end dot
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - 2 * pad);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - 2 * pad);
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  const last = values.length - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="text-accent"
    >
      <title>{label}</title>
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(last)} cy={y(values[last])} r={3.5} fill="currentColor" />
    </svg>
  );
}
