import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AppState } from "../App";
import CellGrid from "../components/CellGrid";
import { cellRisk, RISK_COLORS, type RiskLevel } from "../types";

interface Props {
  state: AppState;
  setSelectedCell: (id: number) => void;
  setSelectedScenario: (id: string) => void;
}

export default function BatteryPack({ state, setSelectedCell }: Props) {
  const navigate = useNavigate();
  const { pack, faultCells } = state;
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  const cellMap = useMemo(() => pack ? new Map(pack.cells.map(c => [c.cell_id, c])) : new Map(), [pack]);

  const hoveredData = hoveredCell ? cellMap.get(hoveredCell) : cellMap.get(state.selectedCell);
  const hoveredId = hoveredCell ?? state.selectedCell;

  const riskCounts = useMemo(() => {
    if (!pack) return {};
    const counts: Record<string, number> = {};
    pack.cells.forEach(c => {
      const r = cellRisk(c, faultCells);
      counts[r] = (counts[r] ?? 0) + 1;
    });
    return counts;
  }, [pack]);

  if (!pack) return <div className="text-slate-500">Loading…</div>;

  const risk = hoveredData ? cellRisk(hoveredData, faultCells) : "unavailable" as RiskLevel;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Battery Pack — 100-Cell Grid</h1>
          <p className="text-sm text-slate-500">{pack.scenario_instance_id} · Cycle {pack.cycle} · 100S1P software abstraction</p>
        </div>
        <div className="flex gap-3 text-xs">
          {(["normal","watch","warning","critical"] as RiskLevel[]).map(r => (
            <div key={r} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS[r] }} />
              <span className="text-slate-400 capitalize">{r} ({riskCounts[r] ?? 0})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Grid */}
        <div className="xl:col-span-2 card">
          <div className="mb-3 text-xs text-slate-500">Click any cell to inspect. Hover for quick stats.</div>
          <div
            onMouseLeave={() => setHoveredCell(null)}
            onMouseOver={e => {
              const btn = (e.target as HTMLElement).closest("button");
              if (btn) {
                const id = parseInt(btn.textContent ?? "0");
                if (!isNaN(id)) setHoveredCell(id);
              }
            }}
          >
            <CellGrid
              cells={pack.cells}
              faultCells={faultCells}
              selectedCell={state.selectedCell}
              onSelectCell={cid => { setSelectedCell(cid); navigate("/cell"); }}
            />
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Source: <span className="font-mono">cell_timeseries.csv</span> · State: aged, cycle {pack.cycle} · Fault cells (scenario metadata): {faultCells.join(", ") || "none"}
          </div>
        </div>

        {/* Cell quick-view */}
        <div className="space-y-3">
          <div className="card" style={{ borderColor: RISK_COLORS[risk] + "60" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-200">Cell {hoveredId}</h3>
              <span className={`badge-${risk}`}>{risk.toUpperCase()}</span>
            </div>
            {hoveredData ? (
              <div className="space-y-2 text-sm">
                {[
                  ["Temperature", `${(hoveredData.cell_temperature_K - 273.15).toFixed(2)} °C`],
                  ["Surface T", `${(hoveredData.surface_temperature_K - 273.15).toFixed(2)} °C`],
                  ["Voltage", `${hoveredData.cell_voltage_V.toFixed(4)} V`],
                  ["Current", `${hoveredData.cell_current_A.toFixed(3)} A`],
                  ["SOH", `${(hoveredData.capacity_retention_soh * 100).toFixed(3)} %`],
                  ["SOC proxy", `${hoveredData.soc_proxy.toFixed(4)}`],
                  ["Fault cell", faultCells.includes(hoveredId) ? "YES ⚠" : "No"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-mono text-slate-300 text-xs">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Hover or click a cell to view data.</p>
            )}
            <button
              onClick={() => { setSelectedCell(hoveredId); navigate("/cell"); }}
              className="mt-3 w-full text-xs py-2 bg-electric-500/20 text-electric-300 border border-electric-500/40 rounded-lg hover:bg-electric-500/30 transition-colors font-medium"
            >
              Inspect Cell {hoveredId} →
            </button>
          </div>

          {/* Legend */}
          <div className="card-sm space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Risk Legend</div>
            {([
              ["normal", "T < 40°C, no anomaly"],
              ["watch", "T 40–48°C or fault region"],
              ["warning", "T 48–55°C or fault elevated"],
              ["critical", "T > 55°C or severe fault"],
            ] as [RiskLevel, string][]).map(([r, desc]) => (
              <div key={r} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: RISK_COLORS[r] }} />
                <span className="text-slate-400 capitalize font-medium w-16">{r}</span>
                <span className="text-slate-600">{desc}</span>
              </div>
            ))}
            <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
              <strong className="text-slate-500">PROJECT DEMONSTRATION CLASSIFICATION.</strong>{" "}
              Risk thresholds derived from PyBaMM simulation data characteristics.
              Not operational safety thresholds. Not validated for real batteries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
