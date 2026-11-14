interface Props {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  color?: string;
  source?: string;
}

export default function MetricCard({ label, value, unit, sub, color, source }: Props) {
  return (
    <div className="card">
      <div className="metric-label mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`metric-value ${color ?? ""}`}>{value}</span>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      {source && <div className="source-tag mt-2">{source}</div>}
    </div>
  );
}
