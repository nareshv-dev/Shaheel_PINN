import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";

interface Series {
  key: string;
  label: string;
  color: string;
  unit?: string;
}

interface Props {
  data: Record<string, unknown>[];
  series: Series[];
  xKey: string;
  xLabel?: string;
  title?: string;
  height?: number;
  referenceLines?: { y: number; color: string; label: string }[];
  source?: string;
}

export default function ChartWrapper({ data, series, xKey, xLabel, title, height = 200, referenceLines, source }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="card-sm flex flex-col items-center justify-center text-slate-500 text-sm" style={{ height }}>
        <span className="text-2xl mb-1">—</span>
        <span>No data available</span>
      </div>
    );
  }

  return (
    <div className="card-sm">
      {title && <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</div>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3e" />
          <XAxis
            dataKey={xKey}
            tick={{ fill: "#64748b", fontSize: 10 }}
            label={xLabel ? { value: xLabel, position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 } : undefined}
            tickFormatter={v => typeof v === "number" ? (v > 999 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)) : v}
          />
          <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={40} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1a2235", border: "1px solid #2d3c52", borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(val: unknown, name: unknown) => {
              const s = series.find(s => s.key === name);
              const v = typeof val === "number" ? val.toFixed(4) : String(val ?? "");
              return [`${v} ${s?.unit ?? ""}`, s?.label ?? String(name)];
            }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
          {referenceLines?.map(rl => (
            <ReferenceLine key={rl.label} y={rl.y} stroke={rl.color} strokeDasharray="4 2"
              label={{ value: rl.label, fill: rl.color, fontSize: 9 }} />
          ))}
          {series.map(s => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.key}
              stroke={s.color} dot={false} strokeWidth={1.5} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {source && <div className="source-tag mt-1">{source}</div>}
    </div>
  );
}
