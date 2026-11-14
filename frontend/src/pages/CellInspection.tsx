import { useState, useEffect } from "react";
import type { AppState } from "../App";
import { fetchCellTimeseries } from "../api";
import type { CellTimeseriesRow } from "../types";
import { cellRisk } from "../types";
import ChartWrapper from "../components/ChartWrapper";
import { RefreshCw } from "lucide-react";

interface Props { state: AppState; setSelectedCell: (id: number) => void; setSelectedScenario: (id: string) => void; }

export default function CellInspection({ state }: Props) {
  const { pack, selectedCell } = state;
  const [ts, setTs] = useState<CellTimeseriesRow[]>([]);
  const [loading, setLoading] = useState(false);

  const cell = pack?.cells.find(c => c.cell_id === selectedCell);
  const injectedFault = state.whatIfFaults.find(f => f.cellId === selectedCell);
  const activeInjected = !!injectedFault && state.activeFaultCells.includes(selectedCell);
  const risk = activeInjected ? cell?.what_if_risk ?? "watch" : cell ? cellRisk(cell, state.declaredFaultCells) : "unavailable";
  const displayTemperature = activeInjected ? cell?.what_if_temperature_K ?? cell?.cell_temperature_K : cell?.cell_temperature_K;
  const displayVoltage = activeInjected ? cell?.what_if_voltage_V ?? cell?.cell_voltage_V : cell?.cell_voltage_V;
  const displayResistance = activeInjected ? cell?.what_if_resistance_ohm ?? cell?.dc_pulse_resistance_proxy_ohm : cell?.dc_pulse_resistance_proxy_ohm;

  useEffect(() => {
    setLoading(true);
    fetchCellTimeseries(selectedCell, state.selectedScenario)
      .then(data => { setTs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedCell, state.selectedScenario]);

  // Pick the aged state if available, else healthy
  const aged = ts.filter(r => r.state_kind === "aged");
  const tsData = (aged.length > 0 ? aged : ts).sort((a, b) => a.time_s - b.time_s);

  const chartData = tsData.map(r => ({
    time_s: r.time_s,
    voltage: r.cell_voltage_V,
    temperature: r.cell_temperature_K - 273.15,
    surface_temp: r.surface_temperature_K - 273.15,
    current: r.cell_current_A,
    soh: r.capacity_retention_soh * 100,
    resistance: r.dc_pulse_resistance_proxy_ohm * 1000,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Cell {selectedCell} — Live Trace</h1>
          <p className="text-sm text-slate-500">{state.selectedScenario} · {tsData.length} time points · {ts[0]?.state_kind ?? "—"} state</p>
        </div>
        <span className={`badge-${risk} text-sm px-3 py-1`}>{risk.toUpperCase()}</span>
      </div>

      {/* Cell metadata */}
      {cell && (
        <div className="card grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            ["Cell ID", cell.cell_id],
            ["Scenario", state.selectedScenario],
            ["Temperature", `${displayTemperature === undefined ? "—" : (displayTemperature - 273.15).toFixed(2)} °C (${activeInjected ? "what-if" : "saved"})`],
            ["Surface T", `${(cell.surface_temperature_K - 273.15).toFixed(2)} °C`],
            ["Voltage", `${displayVoltage?.toFixed(4) ?? "—"} V`],
            ["Current", `${cell.cell_current_A.toFixed(3)} A`],
            ["SOH", `${(cell.capacity_retention_soh * 100).toFixed(4)} %`],
            ["SOC proxy", "NOT SCIENTIFICALLY VALIDATED"],
            ["Resistance proxy", `${displayResistance === undefined ? "—" : (displayResistance * 1000).toFixed(4)} mΩ`],
            ["Fault", injectedFault ? `${injectedFault.mechanism} (${activeInjected ? "active" : "scheduled"})` : state.declaredFaultCells.includes(selectedCell) ? "Declared scenario fault" : "No"],
            ["Snapshot time", `${cell.time_s.toFixed(0)} s`],
            ["Simulation time", `${state.simulation.timeS.toFixed(1)} s`],
            ["Source", activeInjected ? "Interactive What-If + saved baseline" : "Saved Research Data · cell_timeseries.csv"],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="metric-label">{label}</div>
              <div className="text-slate-200 font-mono text-xs mt-0.5">{String(value)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card-sm border-warning-500/30 bg-warning-500/5 text-xs text-slate-500 leading-relaxed">
        <strong className="text-warning-400">SOC proxy:</strong> The soc_proxy column in cell_timeseries.csv contains negative values
        (e.g. −0.05) for some cells. This is a known dataset issue — physical SOC cannot be negative.
        Physical SOC validation is unavailable for this dataset. The proxy is excluded from dashboard displays.
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <RefreshCw size={14} className="animate-spin" /> Loading time-series data…
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartWrapper data={chartData} xKey="time_s" xLabel="Time (s)"
          title="Cell Voltage (V)" height={180}
          series={[{ key: "voltage", label: "Voltage", color: "#60a5fa", unit: "V" }]}
          source="cell_timeseries.csv · PyBaMM DFN simulation" />

        <ChartWrapper data={chartData} xKey="time_s" xLabel="Time (s)"
          title="Temperature (°C)" height={180}
          series={[
            { key: "temperature", label: "Cell T", color: "#f97316", unit: "°C" },
            { key: "surface_temp", label: "Surface T", color: "#fbbf24", unit: "°C" },
          ]}
          referenceLines={[{ y: 45, color: "#fbbf24", label: "Watch" }, { y: 55, color: "#ef4444", label: "Critical" }]}
          source="cell_timeseries.csv · PyBaMM DFN simulation" />

        <ChartWrapper data={chartData} xKey="time_s" xLabel="Time (s)"
          title="Cell Current (A)" height={180}
          series={[{ key: "current", label: "Current", color: "#22d3ee", unit: "A" }]}
          source="cell_timeseries.csv · PyBaMM DFN simulation" />

        <ChartWrapper data={chartData} xKey="time_s" xLabel="Time (s)"
          title="Capacity Retention SOH (%)" height={180}
          series={[{ key: "soh", label: "SOH", color: "#a3e635", unit: "%" }]}
          referenceLines={[{ y: 80, color: "#ef4444", label: "80% threshold" }]}
          source="cell_timeseries.csv · PyBaMM OKane2022 ageing" />

        <ChartWrapper data={chartData} xKey="time_s" xLabel="Time (s)"
          title="DC Resistance Proxy (mΩ)" height={180}
          series={[{ key: "resistance", label: "Resistance", color: "#c084fc", unit: "mΩ" }]}
          source="cell_timeseries.csv · dc_pulse_resistance_proxy_ohm × 1000" />
      </div>

      <div className="card-sm">
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Data source:</strong> PyBaMM DFN electrochemical simulation with OKane2022 coupled ageing model.
          State kind: <span className="font-mono text-slate-400">{ts[0]?.state_kind ?? "—"}</span> ·
          Ageing cycles: <span className="font-mono text-slate-400">{ts[0]?.ageing_cycles ?? "—"}</span> ·
          SOC proxy validity note: physical SOC validation is unavailable for this dataset.
          Resistance proxy: not a certified DC-IR measurement.
        </p>
      </div>
    </div>
  );
}
