"""Real-time simulation engine.

Runs in a background thread, independent of any browser connection. Every tick
it advances simulated cycle time, asks the trained PINN for all 100 cells'
state at their (possibly degraded) effective operating point, applies the
pack's risk rules, and appends to rolling history buffers. The web server only
ever reads this engine's current snapshot -- it never blocks the simulation.
"""
import threading
import time
import collections

import numpy as np

from pack_config import (
    PACK_SIZE, DEGRADED_CELL_ID, SCENARIOS, DEFAULT_SCENARIO, risk_level,
    cell_position, DEGRADATION_TO_EFFECTIVE_C_RATE_GAIN,
    DEGRADATION_TO_EFFECTIVE_T_AMB_GAIN_C, INTERVENTION_CURRENT_DERATE,
    INTERVENTION_TRIGGER_RISK, RISK_LEVELS,
)
from pinn_inference import load_model

CYCLE_SECONDS = 18.0       # wall-clock seconds per simulated discharge cycle
TICK_SECONDS = 0.35        # simulation step
HISTORY_LEN = 400          # ring buffer length per tracked cell


class SimulationEngine:
    def __init__(self):
        self.model = load_model()
        self.lock = threading.RLock()
        self.scenario_key = DEFAULT_SCENARIO
        self.running = True
        self.speed = 1.0
        self.sim_time = 0.0          # wall-clock-equivalent seconds, scaled by speed
        self.cycle_count = 0
        self.t_norm = 0.0
        self.degradation = np.zeros(PACK_SIZE + 1)   # 1-indexed, [0] unused
        self.cells = {}               # cell_id -> latest state dict
        self.history = {cid: collections.deque(maxlen=HISTORY_LEN)
                         for cid in range(1, PACK_SIZE + 1)}
        self.events = collections.deque(maxlen=200)
        self.intervention_active = False
        self._last_risk = {cid: "normal" for cid in range(1, PACK_SIZE + 1)}
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._log_event("Simulation started", f"Scenario {DEFAULT_SCENARIO} loaded, pack idle.")
        self._thread.start()

    # ---- control API --------------------------------------------------
    def set_scenario(self, key):
        with self.lock:
            if key in SCENARIOS:
                self.scenario_key = key
                self.intervention_active = False
                self._log_event("Scenario changed", SCENARIOS[key]["name"])

    def set_running(self, running):
        with self.lock:
            self.running = running

    def set_speed(self, speed):
        with self.lock:
            self.speed = max(0.25, min(8.0, float(speed)))

    def reset(self):
        with self.lock:
            self.degradation[:] = 0.0
            self.cycle_count = 0
            self.sim_time = 0.0
            self.intervention_active = False
            for cid in self.history:
                self.history[cid].clear()
            self.events.clear()
            self._log_event("Pack reset", "Degradation cleared, cycle counter zeroed.")

    # ---- internals ------------------------------------------------------
    def _log_event(self, title, detail):
        self.events.appendleft(dict(
            t=time.strftime("%H:%M:%S"), sim_time=round(self.sim_time, 1),
            title=title, detail=detail,
        ))

    def _run(self):
        while True:
            time.sleep(TICK_SECONDS)
            with self.lock:
                if self.running:
                    self._tick()

    def _tick(self):
        scen = SCENARIOS[self.scenario_key]
        dt = TICK_SECONDS * self.speed
        self.sim_time += dt

        prev_t_norm = self.t_norm
        self.t_norm = (self.t_norm + dt / CYCLE_SECONDS) % 1.0
        wrapped = self.t_norm < prev_t_norm
        if wrapped:
            self.cycle_count += 1
            self._apply_degradation(scen)

        base_c_rate = scen["c_rate"]
        base_T_amb = scen["T_amb_C"]

        worst_level_idx = 0
        snapshot = {}
        for cid in range(1, PACK_SIZE + 1):
            deg = self.degradation[cid]
            eff_c_rate = base_c_rate
            eff_T_amb = base_T_amb

            if cid == DEGRADED_CELL_ID or deg > 0:
                eff_c_rate = base_c_rate * (1.0 + DEGRADATION_TO_EFFECTIVE_C_RATE_GAIN * deg)
                eff_T_amb = base_T_amb + DEGRADATION_TO_EFFECTIVE_T_AMB_GAIN_C * deg

                if scen["intervention"] and self._last_risk[cid] in ("warning", "critical"):
                    eff_c_rate *= (1.0 - INTERVENTION_CURRENT_DERATE)
                    if cid == DEGRADED_CELL_ID:
                        self.intervention_active = True

            st = self.model.predict_cell_state(self.t_norm, eff_c_rate, eff_T_amb)
            level = risk_level(st["T_C"], st["sigma_r_MPa"], st["sigma_t_MPa"])
            worst_level_idx = max(worst_level_idx, RISK_LEVELS.index(level))

            row, col = cell_position(cid)
            rec = dict(
                cell_id=cid, row=row, col=col,
                degradation=round(float(deg), 4),
                c_surface_pct=round(st["c_surface_norm"] * 100, 2),
                T_C=round(st["T_C"], 2),
                sigma_r_MPa=round(st["sigma_r_MPa"], 2),
                sigma_t_MPa=round(st["sigma_t_MPa"], 2),
                risk=level,
                eff_c_rate=round(eff_c_rate, 3),
            )
            snapshot[cid] = rec

            if level != self._last_risk[cid] and (cid == DEGRADED_CELL_ID or level in ("warning", "critical")):
                self._log_event(
                    f"Cell {cid} risk -> {level}",
                    f"T={rec['T_C']}C  sigma_r={rec['sigma_r_MPa']}MPa  sigma_t={rec['sigma_t_MPa']}MPa")
            self._last_risk[cid] = level

            self.history[cid].append(dict(
                t=round(self.sim_time, 2), T_C=rec["T_C"],
                sigma_t_MPa=rec["sigma_t_MPa"], c_surface_pct=rec["c_surface_pct"],
            ))

        self.cells = snapshot
        self._rank_anomalies()

    def _apply_degradation(self, scen):
        self.degradation[DEGRADED_CELL_ID] = min(
            1.0, self.degradation[DEGRADED_CELL_ID] + scen["degraded_increment"])
        self.degradation[1:] += scen["baseline_increment"] * 0.08
        self.degradation[DEGRADED_CELL_ID] -= scen["baseline_increment"] * 0.08  # don't double count
        np.clip(self.degradation, 0.0, 1.0, out=self.degradation)

    def _rank_anomalies(self):
        """Early-warning ranking: deviation of each cell's temperature from the
        pack median, which is exactly the heuristic used in
        Cell_Localization_EarlyWarning_V1.ipynb, run here on live PINN output."""
        temps = np.array([self.cells[cid]["T_C"] for cid in range(1, PACK_SIZE + 1)])
        median_T = float(np.median(temps))
        deviations = []
        for cid in range(1, PACK_SIZE + 1):
            dev = self.cells[cid]["T_C"] - median_T
            deviations.append((cid, dev))
        deviations.sort(key=lambda x: -x[1])
        self.median_T = median_T
        self.ranking = deviations[:5]

    # ---- read API ---------------------------------------------------------
    def snapshot(self):
        with self.lock:
            scen = SCENARIOS[self.scenario_key]
            return dict(
                scenario=self.scenario_key,
                scenario_name=scen["name"],
                scenario_description=scen["description"],
                intervention_active=self.intervention_active,
                sim_time=round(self.sim_time, 1),
                cycle_count=self.cycle_count,
                t_norm=round(self.t_norm, 3),
                running=self.running,
                speed=self.speed,
                median_T=round(getattr(self, "median_T", 25.0), 2),
                ranking=[dict(cell_id=cid, deviation_C=round(dev, 2))
                         for cid, dev in getattr(self, "ranking", [])],
                cells=list(self.cells.values()),
                degraded_cell_id=DEGRADED_CELL_ID,
            )

    def cell_history(self, cell_id):
        with self.lock:
            return list(self.history.get(cell_id, []))

    def event_log(self):
        with self.lock:
            return list(self.events)


_engine = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = SimulationEngine()
    return _engine
