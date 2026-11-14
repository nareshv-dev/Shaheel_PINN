import { useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import type { AppState } from "../App";
import { fetchPinnPredictions, fetchParticleProfiles } from "../api";
import type { PinnPrediction } from "../types";

interface Props { state: AppState; setSelectedCell: (id: number) => void; setSelectedScenario: (id: string) => void; }

export default function MultiphysicsInsights({ state }: Props) {
  const [seed, setSeed] = useState(11);
  const [pinn, setPinn] = useState<PinnPrediction[]>([]);
  const [particles, setParticles] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPinnPredictions(seed), fetchParticleProfiles(state.selectedScenario)])
      .then(([p, pp]) => { setPinn(p); setParticles(pp); setLoading(false); })
      .catch(() => setLoading(false));
  }, [seed, state.selectedScenario]);

  // Pick a fixed condition (1.25C, 20°C test split) for display
  const testPinn = pinn.filter(p => p.split === "test" && p.T_amb_C === 20.0 && p.c_rate === 1.25);
  // Sort by r_norm for concentration profile
  const profileData = [...testPinn].sort((a, b) => a.r_norm - b.r_norm).map(p => ({
    r_norm: p.r_norm,
    c_actual: p.c_mol_m3,
    c_pred: p.pred_c_mol_m3,
    sigma_r: p.sigma_r_MPa,
    sigma_t: p.sigma_t_MPa,
  }));

  // T-rise vs time
  const tRiseData = [...testPinn].sort((a, b) => a.t_norm - b.t_norm)
    .filter(p => p.r_norm < 0.01)
    .map(p => ({ t_norm: p.t_norm, T_rise_pred: p.pred_T_rise_K }));

  // Particle profiles from PyBaMM
  const ppData = particles
    .filter((p: Record<string, unknown>) => p.cell_id === state.selectedCell)
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.radial_position_normalized) - Number(b.radial_position_normalized))
    .map((p: Record<string, unknown>) => ({
      r_norm: p.radial_position_normalized,
      c: p.negative_particle_concentration,
      sigma_r: p.negative_radial_stress,
      sigma_t: p.negative_tangential_stress,
    }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Multiphysics Insights</h1>
        <p className="text-sm text-slate-500">Physics-Consistent Multiphysics PINN · proposed variant · single-cell experiment</p>
      </div>

      {/* Disclaimer */}
      <div className="card-sm bg-graphite-700/50 border-graphite-500/60">
        <p className="text-xs text-slate-400 leading-relaxed">
          <strong className="text-slate-300">Scientific note:</strong> The PC-MP-PINN is a single-cell model trained on one operating condition at a time.
          Results shown here are for <span className="font-mono text-cyan-400">seed={seed}, condition 1.25C @ 20°C, test split</span>.
          Stress (σ<sub>r</sub>, σ<sub>θ</sub>) is computed analytically from the predicted concentration using the
          Cheng–Verbrugge spherical linear-elastic operator — not independently predicted.
          Invalid concentration pairs (c_mol_m3 ≤ 0) have been excluded ({pinn.length === 0 ? "…" : "6,210 rows excluded from 19,440 total"}).
        </p>
      </div>

      {/* Seed selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-400">Seed:</span>
        {[11, 22, 33].map(s => (
          <button key={s} onClick={() => setSeed(s)}
            className={`px-3 py-1 text-sm rounded-lg font-mono font-bold transition-colors ${seed === s ? "bg-electric-500/30 text-electric-300 border border-electric-500/50" : "text-slate-400 border border-graphite-600 hover:border-graphite-500"}`}>
            Seed {s}
          </button>
        ))}
        {loading && <span className="text-xs text-slate-500">Loading…</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Concentration profile */}
        <div className="card-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            PC-MP-PINN Research Experiment — Lithium Concentration
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={profileData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3e" />
              <XAxis dataKey="r_norm" tick={{ fill: "#64748b", fontSize: 10 }} label={{ value: "r/R (normalized)", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ backgroundColor: "#1a2235", border: "1px solid #2d3c52", borderRadius: 8, fontSize: 11 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="c_actual" name="Actual c (mol/m³)" stroke="#60a5fa" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="c_pred" name="PC-MP-PINN pred" stroke="#22d3ee" dot={false} strokeWidth={2} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <div className="source-tag mt-1">predictions_proposed_pc-mp-pinn_seed_{seed}.csv</div>
        </div>

        {/* Stress profile */}
        <div className="card-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            PC-MP-PINN Research Experiment — Stress
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={profileData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3e" />
              <XAxis dataKey="r_norm" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ backgroundColor: "#1a2235", border: "1px solid #2d3c52", borderRadius: 8, fontSize: 11 }} formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(4) : String(v ?? ""), ""]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="sigma_r" name="σᵣ radial (MPa)" stroke="#f97316" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="sigma_t" name="σθ tangential (MPa)" stroke="#c084fc" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <div className="source-tag mt-1">Analytically derived · sigma_r/sigma_t columns in predictions CSV</div>
        </div>

        {/* T-rise */}
        <div className="card-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            PC-MP-PINN Research Experiment — Temperature Rise
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={tRiseData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3e" />
              <XAxis dataKey="t_norm" tick={{ fill: "#64748b", fontSize: 10 }} label={{ value: "t/t_end (norm.)", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={40} />
              <Tooltip contentStyle={{ backgroundColor: "#1a2235", border: "1px solid #2d3c52", borderRadius: 8, fontSize: 11 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="T_rise_pred" name="PC-MP-PINN pred ΔT" stroke="#22d3ee" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <div className="source-tag mt-1">pred_T_rise_K · seed {seed} · test split · 1.25C @ 20°C</div>
        </div>

        {/* PyBaMM particle profiles */}
        <div className="card-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Selected Pack Cell — PyBaMM Particle Profiles (Cell {state.selectedCell})
          </div>
          {ppData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ppData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3e" />
                <XAxis dataKey="r_norm" tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={40} />
                <Tooltip contentStyle={{ backgroundColor: "#1a2235", border: "1px solid #2d3c52", borderRadius: 8, fontSize: 11 }} formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(2) : String(v ?? ""), ""]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="c" name="Concentration" stroke="#60a5fa" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="sigma_r" name="σᵣ" stroke="#f97316" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="sigma_t" name="σθ" stroke="#c084fc" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
              No particle profiles for Cell {state.selectedCell} in this scenario
            </div>
          )}
          <div className="source-tag mt-1">particle_profiles.csv · {state.selectedScenario || "selected scenario"}</div>
        </div>
      </div>

      {/* Physics equations */}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-200 mb-3">Physics Formulation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {[
            {
              title: "Fick's Law — Concentration",
              eq: "∂c/∂t = (Dₛ/r²) ∂/∂r(r² ∂c/∂r)",
              desc: "Spherical diffusion of Li⁺ in negative particle. BC: flux at surface ∝ jₙ; symmetry at r=0.",
              color: "text-cyan-400"
            },
            {
              title: "Thermal Energy Balance",
              eq: "ρcₚ ∂T/∂t = Qᵍᵉⁿ − hAᵥ(T − T_amb)",
              desc: "Single-cell lumped thermal model. Heat generation from PyBaMM tabulated qᵍᵉⁿ(t).",
              color: "text-warning-400"
            },
            {
              title: "Cheng–Verbrugge Stress",
              eq: "σᵣ = (2ΩE)/(3(1−ν)) · (c̄ − c) ; σθ = (ΩE)/(3(1−ν)) · (2c̄ − c(R) − c)",
              desc: "Linear elastic spherical operator. Ω=3.497×10⁻⁶ m³/mol, E=15 GPa, ν=0.30.",
              color: "text-purple-400"
            },
          ].map(({ title, eq, desc, color }) => (
            <div key={title} className="card-sm">
              <div className={`text-xs font-bold ${color} mb-1`}>{title}</div>
              <div className="font-mono text-slate-300 text-[10px] bg-navy-900/60 p-2 rounded mb-2">{eq}</div>
              <p className="text-slate-500 text-[10px] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
