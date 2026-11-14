import { useState, useEffect } from "react";
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";
import type { AppState } from "../App";
import { fetchInterventions } from "../api";
import type { InterventionRecord } from "../types";

interface Props { state: AppState; setSelectedCell: (id: number) => void; setSelectedScenario: (id: string) => void; }

export default function BMSIntervention({ state }: Props) {
  const { currentInstance } = state;
  const [interventions, setInterventions] = useState<InterventionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInterventions().then(i => { setInterventions(i); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  // Show only the intervention records related to the selected source scenario.
  const allFaultGroups = Array.from(new Set(interventions.map(i => JSON.stringify(i.fault_cells))))
    .map(k => JSON.parse(k) as number[]);

  const relatedInterventions = currentInstance?.scenario_id === "S6"
    ? interventions.filter(i => i.scenario_instance_id === currentInstance.scenario_instance_id)
    : interventions.filter(i => i.base_scenario === currentInstance?.scenario_instance_id);
  const selectedInterventions = relatedInterventions
    .sort((a, b) => a.candidate_charge_rate_C - b.candidate_charge_rate_C);

  const compData = selectedInterventions.map(r => ({
    rate: `${r.candidate_charge_rate_C}C`,
    max_pack_V: r.max_pack_voltage_V,
    min_pack_V: r.min_pack_voltage_V,
    max_current: r.max_abs_current_A,
    est_peak_T: r.est_peak_temp_K - 273.15,
    volt_range: +(r.max_pack_voltage_V - r.min_pack_voltage_V).toFixed(2),
  }));

  // Declared fault cells from scenario metadata
  const declaredFaults = currentInstance?.fault_cells ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">BMS Intervention — S6 Charge-Rate Sweep</h1>
        <p className="text-sm text-slate-500">
          Saved PyBaMM scenario comparison · 5 candidate rates ·
          Intervention groups: {allFaultGroups.map(g => `[${g.join(",")}]`).join(", ")}
        </p>
      </div>

      {/* Intervention header */}
      <div className="card border-warning-500/40 bg-warning-500/5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="metric-label text-warning-400">Scenario Fault Cell(s)</div>
            <div className="text-2xl font-bold text-warning-400 font-mono">
              Cell{declaredFaults.length > 1 ? "s" : ""} {declaredFaults.join(", ")}
            </div>
            <div className="text-xs text-slate-500 mt-1">From scenario_instances.csv metadata</div>
          </div>
          <div>
            <div className="metric-label">S6 Demo Benchmark</div>
            <div className="text-lg font-bold text-slate-200 font-mono">{currentInstance?.scenario_instance_id ?? "No scenario selected"}</div>
            <div className="text-xs text-slate-500 mt-1">Related saved S6 intervention records</div>
          </div>
          <div>
            <div className="metric-label">Candidate Rates</div>
            <div className="text-xl font-bold text-cyan-300 font-mono">2.0, 1.5, 1.0, 0.8, 0.4 C</div>
            <div className="text-xs text-slate-500 mt-1">S6 intervention instances</div>
          </div>
        </div>
        <div className="mt-3 p-3 bg-navy-800/60 rounded-lg text-xs text-slate-400">
          <strong className="text-slate-300">CANDIDATE INTERVENTION — SAVED SCENARIO COMPARISON.</strong>{" "}
          This compares saved PyBaMM simulation outcomes across charge rates.
          No physical hardware is controlled. No rate is certified safe.
          Est. peak temperature is a physics-derived proxy, not a direct PyBaMM output.
        </div>
      </div>

      {loading && <div className="text-slate-500 text-sm">Loading intervention data…</div>}

      {!loading && selectedInterventions.length > 0 && (
        <>
          {/* Comparison table */}
          <div className="card">
            <h2 className="text-sm font-bold text-slate-200 mb-3">Pack-Level Outcomes by Charge Rate</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-graphite-600">
                    {["Charge Rate", "Max Pack V", "Min Pack V", "V Range", "Max Current (A)", "Est Peak T (°C)", "Source"].map(h => (
                      <th key={h} className="text-left text-slate-500 uppercase tracking-wider pb-2 pr-4 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedInterventions.sort((a, b) => b.candidate_charge_rate_C - a.candidate_charge_rate_C).map(r => {
                    const isCurrent = r.candidate_charge_rate_C === 2.0;
                    const isCandidate = r.candidate_charge_rate_C === 1.0;
                    return (
                      <tr key={r.candidate_charge_rate_C}
                        className={`border-b border-graphite-700/50 ${isCurrent ? "bg-danger-500/10" : isCandidate ? "bg-cyan-500/5" : ""}`}>
                        <td className="py-2 pr-4">
                          <span className={`font-mono font-bold ${isCurrent ? "text-danger-400" : isCandidate ? "text-cyan-300" : "text-slate-300"}`}>
                            {r.candidate_charge_rate_C}C
                            {isCurrent && " (base)"}
                            {isCandidate && " ← candidate"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-slate-300">{r.max_pack_voltage_V.toFixed(2)}</td>
                        <td className="py-2 pr-4 font-mono text-slate-300">{r.min_pack_voltage_V.toFixed(2)}</td>
                        <td className="py-2 pr-4 font-mono text-slate-300">
                          {(r.max_pack_voltage_V - r.min_pack_voltage_V).toFixed(2)}
                        </td>
                        <td className="py-2 pr-4 font-mono text-slate-300">{r.max_abs_current_A.toFixed(1)}</td>
                        <td className="py-2 pr-4 font-mono text-slate-400">
                          {(r.est_peak_temp_K - 273.15).toFixed(1)}
                          <span className="text-slate-600 ml-1">(est.)</span>
                        </td>
                        <td className="py-2 pr-4 text-slate-500">s6_intervention_summary.csv</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-sm">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pack Voltage Range by Charge Rate</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[...compData].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3e" />
                  <XAxis dataKey="rate" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={45} domain={[330, 425]} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a2235", border: "1px solid #2d3c52", borderRadius: 8, fontSize: 11 }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="max_pack_V" name="Max Pack V" fill="#60a5fa" />
                  <Bar dataKey="min_pack_V" name="Min Pack V" fill="#1e3a5f" />
                </BarChart>
              </ResponsiveContainer>
              <div className="source-tag mt-1">s6_intervention_summary.csv · measured pack voltages</div>
            </div>

            <div className="card-sm">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Estimated Peak Temperature by Charge Rate</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[...compData].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3e" />
                  <XAxis dataKey="rate" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={40} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a2235", border: "1px solid #2d3c52", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="est_peak_T" name="Est Peak T (°C)" fill="#f97316"
                    label={{ position: "top", fill: "#94a3b8", fontSize: 9 }} />
                </BarChart>
              </ResponsiveContainer>
              <div className="source-tag mt-1">Physics-estimated from charge-rate · NOT a direct PyBaMM temperature output</div>
            </div>
          </div>
        </>
      )}
      {!loading && selectedInterventions.length === 0 && (
        <div className="card border-slate-600/50 text-sm text-slate-500">
          No saved S6 intervention records are linked to the selected scenario instance.
          Select an S5 source scenario with a mapped intervention group or an S6 candidate instance.
        </div>
      )}

      {/* What-if explanation */}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-200 mb-2">S6 Scenario Comparison — What-If Analysis</h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-3">
          Scenario S6 contains saved 100-cell PyBaMM comparisons for each candidate charge rate while maintaining
          the declared fault cell's degradation state from S5. Pack voltage bounds are <strong className="text-slate-300">saved PyBaMM outputs</strong>.
          Estimated peak temperature is a <strong className="text-warning-400">physics-derived proxy</strong> (lower C-rate → lower Joule heating),
          not a direct PyBaMM temperature output.
          Available saved S6 intervention groups: {allFaultGroups.map(g => `[${g.join(",")}]`).join(", ")}.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {[
            { rate: "2.0C", label: "S5 base rate", color: "text-danger-400", desc: "Highest electrical/thermal stress — declared fault-cell scenario baseline." },
            { rate: "1.0C", label: "Candidate intervention", color: "text-cyan-300", desc: "Balanced reduction. Measured PyBaMM: narrower pack voltage range." },
            { rate: "0.4C", label: "Conservative candidate", color: "text-slate-400", desc: "Maximum protection — lowest voltage range. Slower cycle time trade-off." },
          ].map(({ rate, label, color, desc }) => (
            <div key={rate} className="card-sm">
              <div className={`text-lg font-bold font-mono ${color}`}>{rate}</div>
              <div className={`text-xs font-medium ${color} mb-1`}>{label}</div>
              <p className="text-slate-500 text-[10px] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
