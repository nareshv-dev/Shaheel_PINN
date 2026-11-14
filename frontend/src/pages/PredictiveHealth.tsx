import type { AppState } from "../App";

interface Props { state: AppState; setSelectedCell: (id: number) => void; setSelectedScenario: (id: string) => void; }

export default function PredictiveHealth({ state }: Props) {
  const { pack, selectedCell, selectedScenario, whatIfFaults, simulation, simulationEvents } = state;
  const cell = pack?.cells.find(c => c.cell_id === selectedCell);
  const fault = whatIfFaults.find(f => f.cellId === selectedCell);
  const isActive = !!fault && simulation.timeS >= fault.startTimeS && simulation.timeS <= fault.startTimeS + fault.durationS;
  const temperature = cell && isActive ? cell.what_if_temperature_K ?? cell.cell_temperature_K : cell?.cell_temperature_K;
  const voltage = cell && isActive ? cell.what_if_voltage_V ?? cell.cell_voltage_V : cell?.cell_voltage_V;
  const resistance = cell && isActive ? cell.what_if_resistance_ohm ?? cell.dc_pulse_resistance_proxy_ohm : cell?.dc_pulse_resistance_proxy_ohm;
  const risk = isActive ? cell?.what_if_risk ?? "watch" : "normal";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Predictive Health</h1>
        <p className="text-sm text-slate-500">Current health monitoring for {selectedScenario || "the selected scenario"}</p>
      </div>
      {cell ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card border-cyan-400/40 bg-cyan-400/5">
            <div className="metric-label text-cyan-400">Cell {selectedCell} — Current SOH</div>
            <div className="text-3xl font-bold text-cyan-300 font-mono">
              {(cell.capacity_retention_soh * 100).toFixed(3)}%
            </div>
            <div className="source-tag mt-2">Saved Research Data · cell_timeseries.csv</div>
          </div>
          <div className="card">
            <div className="metric-label">Temperature</div>
            <div className="metric-value">{temperature === undefined ? "—" : (temperature - 273.15).toFixed(2)}<span className="metric-unit">°C</span></div>
            <div className="text-[10px] text-slate-500 mt-1">{isActive ? "INTERACTIVE WHAT-IF" : "SAVED RESEARCH DATA"}</div>
          </div>
          <div className="card">
            <div className="metric-label">Voltage</div>
            <div className="metric-value">{voltage?.toFixed(4) ?? "—"}<span className="metric-unit">V</span></div>
          </div>
          <div className="card">
            <div className="metric-label">Resistance proxy</div>
            <div className="metric-value">{resistance === undefined ? "—" : (resistance * 1000).toFixed(2)}<span className="metric-unit">mΩ</span></div>
          </div>
          <div className={`card border-${risk === "normal" ? "green" : "warning"}-500/40`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="metric-label">Interactive Health Impact</div>
                <div className="text-sm text-slate-300 mt-1">{isActive ? `Cell ${selectedCell} · ${fault?.mechanism}` : "No active injected fault"}</div>
              </div>
              <span className={`badge-${risk}`}>{risk.toUpperCase()}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Deterministic demonstration state at t={simulation.timeS.toFixed(1)}s; not a future-SOH prediction.</p>
          </div>
          {simulationEvents.length > 0 && (
            <div className="card-sm">
              <div className="text-xs font-bold text-slate-400 mb-2">Simulation events</div>
              {simulationEvents.slice(-6).reverse().map(event => <div key={event.id} className="text-xs text-slate-500">t={event.timeS.toFixed(1)}s · Cell {event.cellId ?? "—"} · {event.description}</div>)}
            </div>
          )}
        </div>
      ) : <div className="card text-sm text-slate-500">Select a cell to inspect current health.</div>}

      <div className="card border-warning-500/40 bg-warning-500/5">
        <div className="text-sm font-bold text-warning-400 mb-1">Future-SOH inference is not enabled</div>
        <p className="text-xs text-slate-400 leading-relaxed">
          B1 and B3 are retained as research model architectures, but their saved input contract has not been verified.
          This page therefore shows only saved current-health measurements and does not invent future predictions.
        </p>
      </div>

      <div className="card">
        <h2 className="text-sm font-bold text-slate-200 mb-3">Research Model Architecture</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ["B1 — Data-only future-SOH model", "Research baseline using signal features to estimate future capacity."],
            ["B3 — Physics-informed future-SOH model", "Research variant adding a physics-consistency objective."],
          ].map(([name, description]) => (
            <div key={name} className="card-sm">
              <div className="text-sm font-medium text-slate-200">{name}</div>
              <p className="text-xs text-slate-500 mt-1">{description}</p>
              <span className="inline-block mt-2 text-xs text-slate-400 border border-slate-600 rounded px-2 py-0.5">
                Research Model — Not Enabled
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
