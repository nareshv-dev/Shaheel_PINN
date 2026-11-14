import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BatteryCharging, Cpu, Activity, Zap, AlertTriangle,
  BarChart3, Info, ChevronRight, Wifi, WifiOff, Box, Siren, Wrench
} from "lucide-react";
import Overview from "./pages/Overview";
import BatteryTwin3D from "./pages/BatteryTwin3D";
import BatteryPack from "./pages/BatteryPack";
import CellInspection from "./pages/CellInspection";
import PredictiveHealth from "./pages/PredictiveHealth";
import MultiphysicsInsights from "./pages/MultiphysicsInsights";
import AnomalyDetection from "./pages/AnomalyDetection";
import BMSIntervention from "./pages/BMSIntervention";
import ScenarioAnalysis from "./pages/ScenarioAnalysis";
import ModelInfo from "./pages/ModelInfo";
import FaultInjectionStudio from "./pages/FaultInjectionStudio";
import { fetchPackSnapshot, fetchScenarios, fetchScenarioInstances } from "./api";
import type { PackSnapshot, RiskLevel, ScenarioInfo, ScenarioInstance, SimulationEvent, SimulationState, WhatIfFault } from "./types";
import { whatIfCellActive } from "./types";

const NAV_ITEMS = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/twin3d", label: "3D Battery Twin", icon: Box },
  { path: "/pack", label: "Battery Pack", icon: BatteryCharging },
  { path: "/cell", label: "Cell Inspection", icon: Cpu },
  { path: "/faults", label: "Fault Injection Studio", icon: Siren },
  { path: "/health", label: "Predictive Health", icon: Activity },
  { path: "/multiphysics", label: "Multiphysics", icon: Zap },
  { path: "/anomaly", label: "Anomaly Detection", icon: AlertTriangle },
  { path: "/intervention", label: "BMS Intervention", icon: Wrench },
  { path: "/scenarios", label: "Scenario Analysis", icon: BarChart3 },
  { path: "/models", label: "Model Info", icon: Info },
];

export interface AppState {
  pack: PackSnapshot | null;
  scenarios: ScenarioInfo[];
  scenarioInstances: ScenarioInstance[];
  selectedCell: number;
  selectedScenario: string;
  currentInstance: ScenarioInstance | null;  // derived from selectedScenario
  faultCells: number[];            // derived from currentInstance, never hardcoded
  isBackendOnline: boolean;
  loading: boolean;
  basePack: PackSnapshot | null;
  whatIfFaults: WhatIfFault[];
  simulation: SimulationState;
  declaredFaultCells: number[];
  activeFaultCells: number[];
  simulationEvents: SimulationEvent[];
}

function mapPackToScenario(pack: PackSnapshot | null, instance: ScenarioInstance | null, extraFaults: number[] = []): PackSnapshot | null {
  if (!pack || !instance) return pack;
  const faultCells = Array.from(new Set([...instance.fault_cells, ...extraFaults]));
  return {
    ...pack,
    scenario_instance_id: instance.scenario_instance_id,
    scenario_id: instance.scenario_id,
    fault_cells: faultCells,
    cells: pack.cells.map(cell => ({
      ...cell,
      scenario_instance_id: instance.scenario_instance_id,
      is_fault_cell: faultCells.includes(cell.cell_id),
      fault_declared: instance.fault_cells.includes(cell.cell_id),
    })),
  };
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<AppState>({
    pack: null, scenarios: [], scenarioInstances: [],
    selectedCell: 1, selectedScenario: "",
    currentInstance: null, faultCells: [],
    isBackendOnline: false, loading: true, basePack: null, whatIfFaults: [],
    simulation: { status: "idle", timeS: 0, speed: 1 },
    declaredFaultCells: [], activeFaultCells: [], simulationEvents: [],
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const setSelectedCell = useCallback((cid: number) => {
    setState(s => ({ ...s, selectedCell: cid }));
  }, []);

  const setSelectedScenario = useCallback((sid: string) => {
    setState(s => ({ ...s, selectedScenario: sid, loading: true, simulation: { ...s.simulation, status: "idle", timeS: 0 }, whatIfFaults: [], simulationEvents: [] }));
  }, []);

  const addWhatIfFault = useCallback((fault: WhatIfFault) => {
    setState(s => ({
      ...s,
      whatIfFaults: [...s.whatIfFaults.filter(f => f.cellId !== fault.cellId), fault],
      faultCells: Array.from(new Set([...s.faultCells, fault.cellId])),
      selectedCell: fault.cellId,
      simulationEvents: [...s.simulationEvents, {
        id: `${Date.now()}-assigned`, timeS: s.simulation.timeS, type: "fault_assigned",
        cellId: fault.cellId, description: `${fault.mechanism} fault assigned`,
      }],
    }));
  }, []);

  const removeWhatIfFault = useCallback((cellId: number) => {
    setState(s => {
      const whatIfFaults = s.whatIfFaults.filter(f => f.cellId !== cellId);
      const scenarioFaults = s.currentInstance?.fault_cells ?? [];
      return {
        ...s, whatIfFaults, faultCells: Array.from(new Set([...scenarioFaults, ...whatIfFaults.map(f => f.cellId)])),
        simulationEvents: [...s.simulationEvents, { id: `${Date.now()}-removed`, timeS: s.simulation.timeS, type: "fault_removed", cellId, description: "Interactive fault removed" }],
      };
    });
  }, []);

  const startSimulation = useCallback(() => {
    setState(s => ({
      ...s, simulation: { ...s.simulation, status: "running" },
      simulationEvents: [...s.simulationEvents, { id: `${Date.now()}-resumed`, timeS: s.simulation.timeS, type: "simulation_resumed", description: "Playback started or resumed" }],
    }));
  }, []);
  const pauseSimulation = useCallback(() => {
    setState(s => ({ ...s, simulation: { ...s.simulation, status: "paused" }, simulationEvents: [...s.simulationEvents, { id: `${Date.now()}-paused`, timeS: s.simulation.timeS, type: "simulation_paused", description: "Playback paused" }] }));
  }, []);
  const resetSimulation = useCallback(() => {
    setState(s => ({
      ...s, whatIfFaults: [], faultCells: s.currentInstance?.fault_cells ?? [],
      pack: mapPackToScenario(s.basePack, s.currentInstance, []),
      simulation: { ...s.simulation, status: "idle", timeS: 0 }, simulationEvents: [...s.simulationEvents, { id: `${Date.now()}-reset`, timeS: 0, type: "simulation_reset", description: "Interactive simulation reset" }],
    }));
  }, []);
  const setSimulationSpeed = useCallback((speed: number) => {
    setState(s => ({ ...s, simulation: { ...s.simulation, speed } }));
  }, []);

  // When selectedScenario changes, derive currentInstance and faultCells from metadata
  useEffect(() => {
    setState(s => {
      const inst = s.scenarioInstances.find(i => i.scenario_instance_id === s.selectedScenario) ?? null;
      const faultCells = inst?.fault_cells ?? s.pack?.fault_cells ?? [];
      // Auto-select first fault cell if current selection is not a fault cell and fault cells exist
      const selectedCell = faultCells.length > 0 ? faultCells[0] : s.selectedCell;
      const interactiveCells = s.whatIfFaults.map(f => f.cellId);
      const combinedFaults = Array.from(new Set([...faultCells, ...interactiveCells]));
      return {
        ...s,
        currentInstance: inst,
        pack: mapPackToScenario(s.basePack ?? s.pack, inst, interactiveCells),
        faultCells: combinedFaults,
        selectedCell,
        loading: false,
        simulation: s.simulation,
      };
    });
  }, [state.selectedScenario, state.scenarioInstances, state.whatIfFaults]);

  // Advance the explicit what-if state without altering saved source data.
  useEffect(() => {
    if (state.simulation.status !== "running") return;
    const timer = window.setInterval(() => {
      setState(s => {
        const nextTime = Math.min(s.simulation.timeS + 0.5 * s.simulation.speed, 120);
        const status = nextTime >= 120 ? "complete" : s.simulation.status;
        const base = mapPackToScenario(s.basePack, s.currentInstance, s.whatIfFaults.map(f => f.cellId));
        if (!base) return { ...s, simulation: { ...s.simulation, timeS: nextTime, status } };
        const cells = base.cells.map(cell => {
          const fault = s.whatIfFaults.find(f => f.cellId === cell.cell_id);
          if (!fault || !whatIfCellActive(fault, nextTime)) return cell;
          const progress = Math.min(1, (nextTime - fault.startTimeS) / Math.max(1, fault.durationS));
          const factor = fault.severity * progress;
          const mechanism = fault.mechanism;
          const thermal = mechanism === "thermal" || mechanism === "combined";
          const mechanical = mechanism === "tangential_stress" || mechanism === "radial_stress" || mechanism === "combined";
          const concentration = mechanism === "concentration" || mechanism === "combined";
          const risk: RiskLevel = thermal && cell.cell_temperature_K + 22 * factor > fault.threshold + 273.15
            ? "warning" : mechanical && factor > 0.7 ? "warning" : factor > 1.5 ? "critical" : "watch";
          return {
            ...cell,
            cell_temperature_K: cell.cell_temperature_K + (thermal ? 22 * factor : 0),
            cell_voltage_V: cell.cell_voltage_V - (mechanism === "voltage" || mechanism === "combined" ? 0.18 * factor : mechanism === "resistance" ? 0.06 * factor : 0),
            dc_pulse_resistance_proxy_ohm: cell.dc_pulse_resistance_proxy_ohm + (mechanism === "resistance" || mechanism === "combined" ? 0.012 * factor : 0),
            capacity_retention_soh: Math.max(0, cell.capacity_retention_soh - (mechanism === "capacity" || mechanism === "combined" ? 0.08 * factor : 0)),
            what_if_temperature_K: cell.cell_temperature_K + (thermal ? 22 * factor : 0),
            what_if_voltage_V: cell.cell_voltage_V - (mechanism === "voltage" || mechanism === "combined" ? 0.18 * factor : mechanism === "resistance" ? 0.06 * factor : 0),
            what_if_resistance_ohm: cell.dc_pulse_resistance_proxy_ohm + (mechanism === "resistance" || mechanism === "combined" ? 0.012 * factor : 0),
            what_if_soh: Math.max(0, cell.capacity_retention_soh - (mechanism === "capacity" || mechanism === "combined" ? 0.08 * factor : 0)),
            what_if_radial_stress_MPa: mechanism === "radial_stress" || mechanism === "combined" ? 3 * factor : 0,
            what_if_tangential_stress_MPa: mechanism === "tangential_stress" || mechanism === "combined" ? 3 * factor : 0,
            what_if_concentration_deviation: concentration ? 0.1 * factor : 0,
            what_if_risk: risk,
          };
        });
        const activeFaultCells = s.whatIfFaults.filter(f => whatIfCellActive(f, nextTime)).map(f => f.cellId);
        const events = [...s.simulationEvents];
        s.whatIfFaults.forEach(fault => {
          const wasActive = whatIfCellActive(fault, s.simulation.timeS);
          const isActive = whatIfCellActive(fault, nextTime);
          if (!wasActive && isActive) {
            events.push({ id: `${Date.now()}-${fault.cellId}-activated`, timeS: nextTime, type: "fault_activated", cellId: fault.cellId, description: `${fault.mechanism} fault activated` });
          }
        });
        return { ...s, pack: { ...base, cells }, activeFaultCells, simulationEvents: events, simulation: { ...s.simulation, timeS: nextTime, status } };
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [state.simulation.status, state.simulation.speed]);

  useEffect(() => {
    // Check backend
    fetch("http://localhost:8000/api/health", { signal: AbortSignal.timeout(1500) })
      .then(r => r.ok && setState(s => ({ ...s, isBackendOnline: true })))
      .catch(() => {});

    Promise.all([fetchPackSnapshot(), fetchScenarios(), fetchScenarioInstances()])
      .then(([pack, scenarios, scenarioInstances]) => {
        const initInst = scenarioInstances[0] ?? null;
        const faultCells = initInst?.fault_cells ?? pack?.fault_cells ?? [];
        const selectedCell = faultCells.length > 0 ? faultCells[0] : 1;
        setState(s => ({
          ...s, pack, scenarios, scenarioInstances,
          basePack: pack, currentInstance: initInst, faultCells, selectedCell,
          declaredFaultCells: faultCells,
          selectedScenario: initInst?.scenario_instance_id ?? scenarioInstances[0]?.scenario_instance_id ?? "",
          loading: false,
        }));
      })
      .catch(() => setState(s => ({ ...s, loading: false })));
  }, []);

  const sharedProps = {
    state, setSelectedCell, setSelectedScenario, addWhatIfFault, removeWhatIfFault,
    startSimulation, pauseSimulation, resetSimulation, setSimulationSpeed,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-navy-950">
      {/* Sidebar */}
      <aside className={`flex flex-col bg-navy-900 border-r border-graphite-700 transition-all duration-200 ${sidebarOpen ? "w-56" : "w-14"} flex-shrink-0`}>
        {/* Brand */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-graphite-700">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-electric-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
            <BatteryCharging size={16} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-200 leading-tight truncate">PINN Digital Twin</div>
              <div className="text-[10px] text-slate-500 truncate">EV Battery Intelligence</div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(o => !o)} className="ml-auto text-slate-500 hover:text-slate-300 flex-shrink-0">
            <ChevronRight size={14} className={`transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
            return (
              <button key={path} onClick={() => navigate(path)}
                className={`nav-item w-full text-left ${active ? "nav-item-active" : "nav-item-inactive"}`}>
                <Icon size={16} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Status */}
        <div className="px-3 py-3 border-t border-graphite-700">
          <div className={`flex items-center gap-1.5 text-xs ${state.isBackendOnline ? "text-green-400" : "text-slate-500"}`}>
            {state.isBackendOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {sidebarOpen && <span>{state.isBackendOnline ? "API connected" : "Demo mode"}</span>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-navy-900/80 backdrop-blur-sm border-b border-graphite-700 px-6 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-medium text-slate-300">
              {NAV_ITEMS.find(n => n.path === location.pathname || (n.path !== "/" && location.pathname.startsWith(n.path)))?.label ?? "Overview"}
            </span>
            {state.selectedScenario && (
              <span className="text-xs text-slate-500">· {state.selectedScenario}</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="sim-badge">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              SIMULATION / PRECOMPUTED DATA
            </span>
            {state.pack && (
              <span className="text-xs text-slate-500 font-mono">
                Cycle {state.pack.cycle} · {state.pack.cell_count} cells
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          <Routes>
            <Route path="/" element={<Overview {...sharedProps} />} />
            <Route path="/twin3d" element={<BatteryTwin3D {...sharedProps} />} />
            <Route path="/pack" element={<BatteryPack {...sharedProps} />} />
            <Route path="/cell" element={<CellInspection {...sharedProps} />} />
            <Route path="/faults" element={<FaultInjectionStudio {...sharedProps} />} />
            <Route path="/health" element={<PredictiveHealth {...sharedProps} />} />
            <Route path="/multiphysics" element={<MultiphysicsInsights {...sharedProps} />} />
            <Route path="/anomaly" element={<AnomalyDetection {...sharedProps} />} />
            <Route path="/intervention" element={<BMSIntervention {...sharedProps} />} />
            <Route path="/scenarios" element={<ScenarioAnalysis {...sharedProps} />} />
            <Route path="/models" element={<ModelInfo {...sharedProps} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
