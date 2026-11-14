import type { AppState } from "../App";

interface Props { state: AppState; setSelectedCell: (id: number) => void; setSelectedScenario: (id: string) => void; }

const TECHNOLOGY = [
  {
    title: "PyBaMM DFN",
    category: "Reference Simulation",
    purpose: "Generates electrochemical reference data for the 100-cell software abstraction.",
    inputs: "Cell parameters, operating conditions and ageing configuration",
    outputs: "Voltage, current, temperature, capacity retention and particle profiles",
    source: "cell_timeseries.csv, pack_timeseries.csv, particle_profiles.csv",
  },
  {
    title: "PC-MP-PINN",
    category: "Saved Research Prediction",
    purpose: "Estimates lithium concentration and temperature rise inside a single electrode particle.",
    inputs: "Normalized radial position, normalized time, C-rate and ambient temperature",
    outputs: "Predicted concentration, temperature rise, radial stress and tangential stress",
    source: "predictions_proposed_pc-mp-pinn_seed_11/22/33.csv",
  },
  {
    title: "Cheng–Verbrugge operator",
    category: "Saved Research Prediction",
    purpose: "Derives particle stress analytically from concentration predictions.",
    inputs: "Predicted concentration and particle material parameters",
    outputs: "Radial and tangential stress",
    source: "Stress columns in the PC-MP-PINN prediction files",
  },
  {
    title: "Signal-statistics anomaly detector",
    category: "Saved Research Prediction",
    purpose: "Ranks cells whose time-series signal behaviour differs from healthy references.",
    inputs: "Saved cell signal statistics",
    outputs: "Anomaly score, threshold comparison and cell ranking",
    source: "08_family_holdout_cell_predictions.csv",
  },
];

export default function ModelInfo(_props: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Models & Technology</h1>
        <p className="text-sm text-slate-500">What each research component does and how it is used in this demonstration.</p>
      </div>
      {TECHNOLOGY.map(model => (
        <div key={model.title} className="card">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-bold text-slate-200">{model.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{model.purpose}</div>
            </div>
            <span className="text-xs text-cyan-300 border border-cyan-400/40 bg-cyan-400/10 rounded px-2 py-0.5 whitespace-nowrap">
              {model.category}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div><div className="text-slate-500 mb-1">Inputs</div><div className="text-slate-300">{model.inputs}</div></div>
            <div><div className="text-slate-500 mb-1">Outputs</div><div className="text-slate-300">{model.outputs}</div></div>
            <div><div className="text-slate-500 mb-1">Source</div><div className="text-slate-400 font-mono">{model.source}</div></div>
          </div>
        </div>
      ))}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-200 mb-2">Research Model Architecture</h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-3">
          B1 (data-only future-SOH) and B3 (physics-informed future-SOH) remain research artifacts.
          Live inference is not enabled because the saved input and normalization contract has not been verified.
          No future-health values are shown as if they were operational predictions.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {["B1 — Data-only future-SOH model", "B3 — Physics-informed future-SOH model"].map(name => (
            <div key={name} className="card-sm">
              <div className="text-sm text-slate-200">{name}</div>
              <div className="text-xs text-slate-400 mt-1">Research Model — Not Enabled</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card border-warning-500/30 bg-warning-500/5 text-xs text-slate-400 leading-relaxed">
        The PC-MP-PINN records represent a single-particle experiment at the documented 1.25C and 20°C test condition.
        They are not applied to every pack cell. Interactive playback is labelled separately as an illustrative what-if model.
      </div>
    </div>
  );
}
