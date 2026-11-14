import { useMemo, useState } from "react";
import { Play, Pause, RotateCcw, Plus, Trash2 } from "lucide-react";
import type { AppState } from "../App";
import { FAULT_MECHANISMS, type FaultMechanism, type WhatIfFault } from "../types";
import CellGrid from "../components/CellGrid";

interface Props {
  state: AppState;
  setSelectedCell: (id: number) => void;
  setSelectedScenario: (id: string) => void;
  addWhatIfFault: (fault: WhatIfFault) => void;
  removeWhatIfFault: (cellId: number) => void;
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
}

export default function FaultInjectionStudio({
  state, setSelectedCell, addWhatIfFault, removeWhatIfFault,
  startSimulation, pauseSimulation, resetSimulation, setSimulationSpeed,
}: Props) {
  const [mechanism, setMechanism] = useState<FaultMechanism>("thermal");
  const [severity, setSeverity] = useState(1);
  const [threshold, setThreshold] = useState(45);
  const [startTimeS, setStartTimeS] = useState(10);
  const [durationS, setDurationS] = useState(60);
  const mechanismInfo = useMemo(() => FAULT_MECHANISMS.find(m => m.value === mechanism)!, [mechanism]);
  const selectedFault = state.whatIfFaults.find(f => f.cellId === state.selectedCell);

  const addFault = (cellId = state.selectedCell) => addWhatIfFault({
    cellId, mechanism, severity, threshold, startTimeS, durationS,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Fault Injection Studio</h1>
        <p className="text-sm text-slate-500">Configure a repeatable interactive what-if experiment for any cell.</p>
      </div>
      <div className="card border-cyan-400/30 bg-cyan-400/5 text-xs text-slate-400 leading-relaxed">
        <strong className="text-cyan-300">INTERACTIVE WHAT-IF MODEL</strong> — illustrative state transitions only;
        this does not execute a new PyBaMM solve or train a PINN. Thresholds are user-configured demonstration values,
        not certified safety limits.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card space-y-4">
          <label className="block text-xs text-slate-400">Target cell
            <select value={state.selectedCell} onChange={e => setSelectedCell(Number(e.target.value))}
              className="input mt-1 w-full">
              {Array.from({ length: 100 }, (_, i) => <option key={i + 1} value={i + 1}>Cell {i + 1}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">Fault mechanism
            <select value={mechanism} onChange={e => setMechanism(e.target.value as FaultMechanism)}
              className="input mt-1 w-full">
              {FAULT_MECHANISMS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <p className="text-xs text-slate-500">{mechanismInfo.description}</p>
          <label className="block text-xs text-slate-400">Severity: {severity.toFixed(1)}
            <input className="w-full accent-cyan-400" type="range" min="0.1" max="3" step="0.1"
              value={severity} onChange={e => setSeverity(Number(e.target.value))} />
          </label>
          <label className="block text-xs text-slate-400">Demonstration threshold ({mechanismInfo.unit})
            <input className="input mt-1 w-full" type="number" value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">Start (s)
              <input className="input mt-1 w-full" type="number" min="0" value={startTimeS} onChange={e => setStartTimeS(Number(e.target.value))} />
            </label>
            <label className="text-xs text-slate-400">Duration (s)
              <input className="input mt-1 w-full" type="number" min="1" value={durationS} onChange={e => setDurationS(Number(e.target.value))} />
            </label>
          </div>
          <button onClick={() => addFault()} className="w-full btn-primary"><Plus size={14} /> Assign fault to Cell {state.selectedCell}</button>
          <div className="border-t border-graphite-600 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Drag marker onto a cell</span>
              <span draggable onDragStart={e => e.dataTransfer.setData("text/plain", "0")}
                className="cursor-grab rounded bg-danger-500/20 px-2 py-1 text-xs text-danger-300">FAULT</span>
            </div>
            <CellGrid cells={state.pack?.cells ?? []} faultCells={state.faultCells}
              selectedCell={state.selectedCell} onSelectCell={setSelectedCell}
              onDropCell={cellId => { setSelectedCell(cellId); addFault(cellId); }} />
          </div>
        </div>
        <div className="card lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-200">Playback</h2>
              <p className="text-xs text-slate-500 font-mono">t = {state.simulation.timeS.toFixed(1)} s · {state.simulation.status}</p>
            </div>
            <div className="flex gap-2">
              {state.simulation.status === "running"
                ? <button onClick={pauseSimulation} className="btn-secondary"><Pause size={14} /> Pause</button>
                : <button onClick={startSimulation} className="btn-primary"><Play size={14} /> Start / Resume</button>}
              <button onClick={resetSimulation} className="btn-secondary"><RotateCcw size={14} /> Reset</button>
            </div>
          </div>
          <label className="text-xs text-slate-400">Playback speed
            <select className="input ml-2" value={state.simulation.speed} onChange={e => setSimulationSpeed(Number(e.target.value))}>
              {[0.5, 1, 2, 4].map(v => <option key={v} value={v}>{v}×</option>)}
            </select>
          </label>
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active fault profiles</h3>
            {state.whatIfFaults.length === 0 && <p className="text-sm text-slate-600">No interactive faults configured.</p>}
            {state.whatIfFaults.map(fault => (
              <div key={fault.cellId} className="flex items-center justify-between rounded-lg border border-graphite-600 bg-navy-800/60 p-3">
                <div className="text-sm text-slate-300">Cell {fault.cellId} · {FAULT_MECHANISMS.find(m => m.value === fault.mechanism)?.label}
                  <div className="text-xs text-slate-500">Severity {fault.severity} · active {fault.startTimeS}–{fault.startTimeS + fault.durationS}s</div>
                </div>
                <button title={`Remove fault from Cell ${fault.cellId}`} onClick={() => removeWhatIfFault(fault.cellId)} className="text-slate-500 hover:text-danger-400"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          {selectedFault && <p className="text-xs text-cyan-400">Cell {state.selectedCell} has a configured interactive profile.</p>}
        </div>
      </div>
    </div>
  );
}
