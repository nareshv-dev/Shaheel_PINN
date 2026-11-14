import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Zap, AlertTriangle, Database, BatteryCharging, ChevronRight } from "lucide-react";
import type { AppState } from "../App";
import { cellRisk } from "../types";
import MetricCard from "../components/MetricCard";

interface Props {
  state: AppState;
  setSelectedCell: (id: number) => void;
  setSelectedScenario: (id: string) => void;
}

export default function Overview({ state, setSelectedCell }: Props) {
  const navigate = useNavigate();
  const { pack, faultCells } = state;

  const stats = useMemo(() => {
    if (!pack) return null;
    const cells = pack.cells;
    const risks = cells.map(c => cellRisk(c, faultCells));
    const count = (r: string) => risks.filter(x => x === r).length;
    const temps = cells.map(c => c.cell_temperature_K - 273.15);
    const volts = cells.map(c => c.cell_voltage_V);
    const sohs = cells.map(c => c.capacity_retention_soh);
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const med = (a: number[]) => { const s = [...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
    return {
      total: cells.length,
      normal: count("normal"), watch: count("watch"), warning: count("warning"), critical: count("critical"),
      avgTemp: avg(temps), medTemp: med(temps),
      avgVolt: avg(volts), avgSOH: avg(sohs),
    };
  }, [pack]);

  if (!pack || !stats) {
    return <div className="text-slate-500 text-sm">Loading pack data…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Pack Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            100-cell EV battery digital twin · {pack.scenario_instance_id} · Cycle {pack.cycle}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="source-tag"><Database size={10} />PyBaMM simulation</span>
          <span className="source-tag"><Activity size={10} />PINN inference</span>
        </div>
      </div>

      {/* Risk summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card border-electric-500/40 bg-electric-500/5">
          <div className="metric-label text-electric-400">Normal</div>
          <div className="text-3xl font-bold text-electric-300 font-mono">{stats.normal}</div>
          <div className="text-xs text-slate-500 mt-0.5">cells operating normally</div>
        </div>
        <div className="card border-amber-500/40 bg-amber-500/5">
          <div className="metric-label text-amber-400">Watch</div>
          <div className="text-3xl font-bold text-amber-300 font-mono">{stats.watch}</div>
          <div className="text-xs text-slate-500 mt-0.5">cells under observation</div>
        </div>
        <div className="card border-warning-500/40 bg-warning-500/5">
          <div className="metric-label text-warning-400">Warning</div>
          <div className="text-3xl font-bold text-warning-400 font-mono">{stats.warning}</div>
          <div className="text-xs text-slate-500 mt-0.5">cells require attention</div>
        </div>
        <div className="card border-danger-500/40 bg-danger-500/5">
          <div className="metric-label text-danger-400">Critical</div>
          <div className="text-3xl font-bold text-danger-400 font-mono">{stats.critical}</div>
          <div className="text-xs text-slate-500 mt-0.5">cells in critical state</div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Avg Temperature" value={(stats.avgTemp).toFixed(1)} unit="°C"
          source="cell_timeseries.csv" color="text-warning-400" />
        <MetricCard label="Median Temperature" value={(stats.medTemp).toFixed(1)} unit="°C"
          source="cell_timeseries.csv" color="text-warning-400" />
        <MetricCard label="Avg Voltage" value={stats.avgVolt.toFixed(4)} unit="V"
          source="cell_timeseries.csv" color="text-electric-300" />
        <MetricCard label="Avg SOH" value={(stats.avgSOH * 100).toFixed(2)} unit="%"
          source="cell_timeseries.csv" color="text-cyan-300" />
      </div>

      {/* Fault cells */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning-400" /> Declared Fault Cells
          </h2>
          <span className="source-tag">scenario_instances.csv</span>
        </div>
        {pack.fault_cells.length === 0 ? (
          <p className="text-sm text-slate-500">No fault cells in this scenario (healthy baseline).</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {pack.fault_cells.map(cid => (
              <button key={cid} onClick={() => { setSelectedCell(cid); navigate("/cell"); }}
                className="flex items-center gap-1.5 bg-danger-500/20 border border-danger-500/40 text-danger-400 text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-danger-500/30 transition-colors">
                <BatteryCharging size={12} /> Cell {cid}
                <ChevronRight size={12} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scenario info */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-cyan-400" />
          <h2 className="text-sm font-bold text-slate-200">Active Scenario</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Scenario instance</span>
              <span className="font-mono text-slate-300 text-xs">{pack.scenario_instance_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Scenario family</span>
              <span className="font-mono text-slate-300 text-xs">{pack.scenario_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ageing cycle</span>
              <span className="font-mono text-slate-300">{pack.cycle}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Total cells</span>
              <span className="font-mono text-slate-300">{pack.cell_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Fault cell count</span>
              <span className="font-mono text-slate-300">{pack.fault_cells.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pack topology</span>
              <span className="font-mono text-slate-300 text-xs">100S1P (software abstraction)</span>
            </div>
          </div>
        </div>
        {state.currentInstance && (
          <div className="mt-3 p-3 bg-navy-800/60 rounded-lg border border-graphite-600/40">
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-300">Instance: {state.currentInstance.scenario_instance_id}</strong> —
              Declared fault cell{state.currentInstance.fault_cells.length > 1 ? "s" : ""}: {" "}
              <span className="text-danger-400 font-mono">{state.currentInstance.fault_cells.join(", ") || "none"}</span>.
              The localization task is to identify which cell deviates from the validated healthy reference
              without being told the fault location (fault_location_is_hidden_to_model=True).
              Split: <span className="font-mono text-slate-400">{state.currentInstance.split}</span>.
            </p>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "View Pack Grid", path: "/pack", desc: "Interactive 100-cell map", icon: BatteryCharging },
          { label: "Cell Inspection", path: "/cell", desc: "Live cell measurements", icon: Activity },
          { label: "Anomaly Ranking", path: "/anomaly", desc: "Signal detector scores", icon: AlertTriangle },
          { label: "BMS Intervention", path: "/intervention", desc: "S6 charging rate sweep", icon: Zap },
        ].map(({ label, path, desc, icon: Icon }) => (
          <button key={path} onClick={() => navigate(path)}
            className="card text-left hover:border-electric-500/60 hover:bg-graphite-700 transition-colors group">
            <Icon size={18} className="text-electric-400 mb-2" />
            <div className="text-sm font-medium text-slate-200 group-hover:text-electric-300">{label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
