"""Canonical 100-cell virtual battery pack specification.

Ported and cleaned from DigitalTwin_V1_Scenario_Design.ipynb: a 100S1P pack
(10x10 grid), cell 37 is the designated degraded candidate, six canonical
multi-physics scenarios (S1-S6), and rule-based risk/intervention logic that
runs on live PINN output rather than on canned numbers.
"""

PACK_ID = "VP_V1_CONFIG_01"
PACK_ROWS, PACK_COLS = 10, 10
PACK_SIZE = PACK_ROWS * PACK_COLS
DEGRADED_CELL_ID = 37   # 1-indexed, matches the notebook's designation

# ---- risk thresholds (physical units, derived from the training data range) -
RISK_THRESHOLDS = dict(
    T_watch_C=45.0, T_warn_C=60.0, T_critical_C=72.0,
    sigma_watch_MPa=16.0, sigma_warn_MPa=22.0, sigma_critical_MPa=27.0,
)

RISK_LEVELS = ["normal", "watch", "warning", "critical"]
RISK_COLORS = {
    "normal":   "#1B7FBF",   # house blue
    "watch":    "#F4A259",   # amber
    "warning":  "#E4572E",   # orange-red
    "critical": "#C1272D",   # red
}

# ---- canonical scenarios (S1-S6) -------------------------------------------
# Each scenario sets the pack's nominal operating point and a per-cycle
# degradation increment applied ONLY to the flagged cell (baseline cells get a
# much smaller aging increment so the pack isn't perfectly static either).
SCENARIOS = {
    "S1": dict(
        name="S1 - Nominal cruise",
        description="Steady highway driving. Moderate C-rate, mild ambient temperature.",
        c_rate=1.0, T_amb_C=25.0,
        degraded_increment=0.010, baseline_increment=0.0015,
        intervention=False,
    ),
    "S2": dict(
        name="S2 - Fast-charge stress",
        description="High C-rate fast charging. Elevated thermal and mechanical load pack-wide.",
        c_rate=2.0, T_amb_C=30.0,
        degraded_increment=0.020, baseline_increment=0.0030,
        intervention=False,
    ),
    "S3": dict(
        name="S3 - Hot climate",
        description="High ambient temperature (desert operation). Accelerates degradation kinetics.",
        c_rate=1.25, T_amb_C=35.0,
        degraded_increment=0.018, baseline_increment=0.0025,
        intervention=False,
    ),
    "S4": dict(
        name="S4 - Cold start",
        description="Low ambient temperature. Higher internal resistance, elevated diffusion stress.",
        c_rate=1.0, T_amb_C=10.0,
        degraded_increment=0.013, baseline_increment=0.0018,
        intervention=False,
    ),
    "S5": dict(
        name="S5 - Localized degradation",
        description="Cell 37 carries pre-existing localized damage. No BMS intervention yet.",
        c_rate=1.5, T_amb_C=25.0,
        degraded_increment=0.028, baseline_increment=0.0015,
        intervention=False,
    ),
    "S6": dict(
        name="S6 - BMS intervention",
        description="Same degradation state as S5, but the BMS derates current to cell 37 on warning.",
        c_rate=1.5, T_amb_C=25.0,
        degraded_increment=0.028, baseline_increment=0.0015,
        intervention=True,
    ),
}

DEFAULT_SCENARIO = "S1"

# how strongly accumulated degradation inflates the *effective* operating
# point fed into the PINN -- the fault signature comes from the physics model
# itself reacting to a worse apparent condition, not from painted numbers.
DEGRADATION_TO_EFFECTIVE_C_RATE_GAIN = 0.65
DEGRADATION_TO_EFFECTIVE_T_AMB_GAIN_C = 22.0   # extra ambient-equivalent heating at full degradation
INTERVENTION_CURRENT_DERATE = 0.35             # fraction cut from effective C-rate once S6 intervenes
INTERVENTION_TRIGGER_RISK = "warning"          # risk level at which S6 derates current


def risk_level(T_C, sigma_r_MPa, sigma_t_MPa):
    sigma_max = max(abs(sigma_r_MPa), abs(sigma_t_MPa))
    t = RISK_THRESHOLDS
    if T_C >= t["T_critical_C"] or sigma_max >= t["sigma_critical_MPa"]:
        return "critical"
    if T_C >= t["T_warn_C"] or sigma_max >= t["sigma_warn_MPa"]:
        return "warning"
    if T_C >= t["T_watch_C"] or sigma_max >= t["sigma_watch_MPa"]:
        return "watch"
    return "normal"


def cell_position(cell_id):
    """1-indexed cell_id -> (row, col) in the 10x10 pack grid."""
    idx = cell_id - 1
    return divmod(idx, PACK_COLS)
