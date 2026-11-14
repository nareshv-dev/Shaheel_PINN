import { useMemo } from "react";
import type { AppState } from "../App";
import type { ScenarioInfo } from "../types";

interface Props { state: AppState; setSelectedCell: (id: number) => void; setSelectedScenario: (id: string) => void; }

const SCENARIO_COLORS: Record<string, string> = {
  S1: "border-electric-500/40 bg-electric-500/5",
  S2: "border-warning-500/40 bg-warning-500/5",
  S3: "border-amber-500/40 bg-amber-500/5",
  S4: "border-danger-500/40 bg-danger-500/5",
  S5: "border-purple-500/40 bg-purple-500/5",
  S6: "border-cyan-400/40 bg-cyan-400/5",
};

const SCENARIO_TEXT: Record<string, string> = {
  S1: "text-electric-300", S2: "text-warning-400", S3: "text-amber-400",
  S4: "text-danger-400", S5: "text-purple-400", S6: "text-cyan-400",
};

export default function ScenarioAnalysis({ state, setSelectedScenario }: Props) {
  const { scenarios } = state;
  const grouped = useMemo(() => {
    const g: Record<string, ScenarioInfo[]> = {};
    for (const s of scenarios) {
      if (!g[s.scenario_id]) g[s.scenario_id] = [];
      g[s.scenario_id].push(s);
    }
    return g;
  }, [scenarios]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Scenario Analysis</h1>
        <p className="text-sm text-slate-500">S1–S6 canonical scenario definitions · v1_scenario_matrix.csv</p>
      </div>

      {/* Comparison table */}
      <div className="card overflow-x-auto">
        <h2 className="text-sm font-bold text-slate-200 mb-3">Scenario Matrix</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-graphite-600">
              {["ID", "Name", "Ambient T (°C)", "Charge Rate (C)", "Degradation", "Purpose"].map(h => (
                <th key={h} className="text-left text-slate-500 uppercase tracking-wider pb-2 pr-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenarios.map(s => (
              <tr key={`${s.scenario_id}-${s.sub_id}`} className="border-b border-graphite-700/50 hover:bg-graphite-700/30">
                <td className="py-2 pr-4">
                  <span className={`font-mono font-bold ${SCENARIO_TEXT[s.scenario_id] ?? "text-slate-300"}`}>{s.scenario_id}</span>
                </td>
                <td className="py-2 pr-4 text-slate-300">{s.name}</td>
                <td className="py-2 pr-4 font-mono text-slate-300">{s.ambient_temp_c}</td>
                <td className="py-2 pr-4 font-mono text-slate-300">{s.charge_rate_c}C</td>
                <td className="py-2 pr-4 text-slate-400">{s.degradation_state}</td>
                <td className="py-2 pr-4 text-slate-500 max-w-xs">{s.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scenario cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(grouped).map(([sid, group]) => (
          <div key={sid} className={`card ${SCENARIO_COLORS[sid] ?? ""}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-lg font-bold font-mono ${SCENARIO_TEXT[sid] ?? "text-slate-300"}`}>{sid}</span>
              <span className="text-xs text-slate-500">{group[0].instances.length} instance{group[0].instances.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="text-sm font-medium text-slate-200 mb-1">{group[0].name}</div>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">{group[0].purpose}</p>
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Ambient T</span>
                <span className="font-mono text-slate-400">{group[0].ambient_temp_c}°C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Charge rate</span>
                <span className="font-mono text-slate-400">{group[0].charge_rate_c}C</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {group[0].instances.map(inst => (
                <button key={inst} onClick={() => setSelectedScenario(inst)}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono border transition-colors ${state.selectedScenario === inst ? `${SCENARIO_TEXT[sid]} border-current bg-current/10` : "text-slate-500 border-graphite-600 hover:border-graphite-500"}`}>
                  {inst}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Data provenance */}
      <div className="card-sm">
        <div className="text-xs font-bold text-slate-400 mb-2">Data Provenance</div>
        <div className="space-y-1 text-xs text-slate-500">
          <div><span className="text-slate-400">Source:</span> v1_scenario_specification.json · v1_scenario_matrix (1).csv · scenario_instances.csv</div>
          <div><span className="text-slate-400">Simulation:</span> PyBaMM DFN model · OKane2022 coupled ageing · Chen2020 parameters</div>
          <div><span className="text-slate-400">Pack topology:</span> 100S1P software abstraction (common-current assumption, not full electrical network solver)</div>
          <div><span className="text-slate-400">Threshold status:</span> UNRESOLVED_UNTIL_VALIDATED in scenario_instances.csv</div>
        </div>
      </div>
    </div>
  );
}
