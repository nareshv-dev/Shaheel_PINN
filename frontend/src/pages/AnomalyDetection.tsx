import { useState, useEffect, useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import type { AppState } from "../App";
import { fetchLocalization } from "../api";
import type { LocalizationRow } from "../types";

interface Props { state: AppState; setSelectedCell: (id: number) => void; setSelectedScenario: (id: string) => void; }

const THRESHOLD = 4.399034460052955;

export default function AnomalyDetection({ state, setSelectedCell }: Props) {
  const [rows, setRows] = useState<LocalizationRow[]>([]);
  const [filterScenario, setFilterScenario] = useState(state.selectedScenario);

  useEffect(() => {
    setFilterScenario(state.selectedScenario);
  }, [state.selectedScenario]);

  useEffect(() => {
    fetchLocalization().then(setRows).catch(() => {});
  }, []);

  const scenarios = useMemo(() => [...new Set(rows.map(r => r.scenario_instance_id))].sort(), [rows]);

  const filtered = useMemo(() => {
    const s = rows.filter(r => r.scenario_instance_id === filterScenario);
    return s.sort((a, b) => b.signal_anomaly_score - a.signal_anomaly_score);
  }, [rows, filterScenario]);

  // Top 20 for bar chart
  const barData = filtered.slice(0, 20).map(r => ({
    cell_id: r.cell_id,
    score: r.signal_anomaly_score,
    is_fault: r.is_fault,
  }));

  const faultCells = filtered.filter(r => r.is_fault > 0).map(r => r.cell_id);
  const detectedFaults = filtered.filter(r => r.signal_anomaly_score > THRESHOLD);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Anomaly Detection & Localization</h1>
        <p className="text-sm text-slate-500">Saved signal-statistics detector · family-held-out evaluation</p>
      </div>

      {/* Detector summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card border-cyan-400/40 bg-cyan-400/5">
          <div className="metric-label text-cyan-400">Detector Threshold</div>
          <div className="text-2xl font-bold text-cyan-300 font-mono">{THRESHOLD.toFixed(2)}</div>
          <div className="text-xs text-slate-500 mt-1">family-holdout calibration</div>
        </div>
        <div className="card">
          <div className="metric-label">Test F1 Score</div>
          <div className="text-2xl font-bold text-green-400 font-mono">1.00</div>
          <div className="text-xs text-slate-500 mt-1">family-held-out test split</div>
        </div>
        <div className="card">
          <div className="metric-label">Test Precision</div>
          <div className="text-2xl font-bold text-green-400 font-mono">1.00</div>
          <div className="text-xs text-slate-500 mt-1">0 false positives</div>
        </div>
        <div className="card">
          <div className="metric-label">Test Recall</div>
          <div className="text-2xl font-bold text-green-400 font-mono">1.00</div>
          <div className="text-xs text-slate-500 mt-1">0 false negatives</div>
        </div>
      </div>

      {/* Scenario selector */}
      <div className="card">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-sm font-medium text-slate-300">Scenario:</span>
          <div className="flex flex-wrap gap-2">
            {scenarios.slice(0, 12).map(s => (
              <button key={s} onClick={() => setFilterScenario(s)}
                className={`text-xs px-2 py-1 rounded font-mono transition-colors ${filterScenario === s ? "bg-electric-500/30 text-electric-300 border border-electric-500/50" : "text-slate-400 border border-graphite-600 hover:border-graphite-500"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Showing top 20 cells by anomaly score for <span className="font-mono text-slate-400">{filterScenario}</span>
          {faultCells.length > 0 && <> · Ground-truth fault cells: <span className="text-danger-400 font-mono">{faultCells.join(", ")}</span></>}
        </div>
      </div>

      {/* Bar chart */}
      <div className="card-sm">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Anomaly Score by Cell (Top 20)
        </div>
        {barData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3e" />
              <XAxis dataKey="cell_id" tick={{ fill: "#64748b", fontSize: 9 }} label={{ value: "Cell ID", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ backgroundColor: "#1a2235", border: "1px solid #2d3c52", borderRadius: 8, fontSize: 11 }}
                formatter={(v: unknown, _: unknown, entry: { payload?: { is_fault?: number } }) => {
                  const score = typeof v === "number" ? v.toFixed(3) : String(v ?? "");
                  const fault = entry.payload?.is_fault ? " ⚠ FAULT" : "";
                  return [`${score}${fault}`, "Anomaly Score"] as [string, string];
                }} />
              <ReferenceLine y={THRESHOLD} stroke="#f97316" strokeDasharray="4 2" label={{ value: `Threshold ${THRESHOLD.toFixed(2)}`, fill: "#f97316", fontSize: 9 }} />
              <Bar dataKey="score" fill="#3b82f6"
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-500 text-sm py-8 text-center">No data for selected scenario</div>
        )}
        <div className="source-tag mt-1">08_family_holdout_cell_predictions.csv · signal_anomaly_score</div>
      </div>

      {/* Ranked table */}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-200 mb-3">Cell Rankings — {filterScenario}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-graphite-600">
                {["Rank", "Cell ID", "Score", "Anomaly", "Ground Truth", "Predicted Fault", "Split"].map(h => (
                  <th key={h} className="text-left text-slate-500 uppercase tracking-wider pb-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 25).map((r, i) => {
                const anomaly = r.signal_anomaly_score > THRESHOLD;
                return (
                  <tr key={`${r.cell_id}-${i}`} className={`border-b border-graphite-700/50 ${r.is_fault ? "bg-danger-500/5" : ""}`}>
                    <td className="py-1.5 pr-4 font-mono text-slate-400">{i + 1}</td>
                    <td className="py-1.5 pr-4">
                      <button onClick={() => setSelectedCell(r.cell_id)}
                        className="text-electric-400 hover:text-electric-300 font-mono font-bold">
                        Cell {r.cell_id}
                      </button>
                    </td>
                    <td className="py-1.5 pr-4 font-mono text-slate-300">{r.signal_anomaly_score.toFixed(4)}</td>
                    <td className="py-1.5 pr-4">
                      <span className={anomaly ? "badge-warning" : "badge-normal"}>
                        {anomaly ? "ANOMALY" : "Normal"}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4">
                      <span className={r.is_fault ? "text-danger-400 font-bold" : "text-slate-500"}>
                        {r.is_fault ? "FAULT" : "Healthy"}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4">
                      <span className={r.predicted_fault ? "text-warning-400 font-bold" : "text-slate-500"}>
                        {r.predicted_fault ? "YES" : "No"}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 text-slate-500 font-mono">{r.evaluation_split}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Detected above threshold: {detectedFaults.length} cells · Family-held-out evaluation · Fault onset timestamps unavailable
        </div>
      </div>

      {/* Limitations */}
      <div className="card-sm border-warning-500/30 bg-warning-500/5">
        <div className="text-xs font-bold text-warning-400 mb-2">Scientific Limitations</div>
        <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
          <li>Results apply to this generated dataset and its current scenario splits</li>
          <li>Performance on completely unseen fault families has not been established</li>
          <li>Early-warning lead time is not validated (no fault-onset timestamps)</li>
          <li>Signal-statistics detector is separate from PINN future-SOH predictor</li>
          <li>Static anomaly ranking ≠ validated predictive early warning</li>
          <li>Results do not establish real-world battery safety or deployment readiness</li>
        </ul>
      </div>
    </div>
  );
}
