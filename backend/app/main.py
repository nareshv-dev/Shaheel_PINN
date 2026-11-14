"""FastAPI backend — read-only data services for PINN Digital Twin dashboard."""
from __future__ import annotations
import json
import math
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="PINN Digital Twin API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

ROOT = Path(__file__).parent.parent.parent
DATA = ROOT / "data" / "demo"
PROJECT = ROOT / "PINN_EV_BATTERY_PROJECT"


def _load_json(path: Path) -> Any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _clean_floats(obj: Any) -> Any:
    """Replace NaN/Inf with None so JSON serialization never fails."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _clean_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean_floats(v) for v in obj]
    return obj


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "demo_data": DATA.exists()}


# ── Pack snapshot ──────────────────────────────────────────────────────────────

@app.get("/api/battery/pack-snapshot")
@app.get("/api/pack/snapshot")
def pack_snapshot(scenario: str | None = Query(None)):
    path = DATA / "demo_pack_snapshot.json"
    if not path.exists():
        raise HTTPException(404, "Pack snapshot not found")
    data = _load_json(path)
    return _clean_floats(data)


# ── Scenarios ─────────────────────────────────────────────────────────────────

@app.get("/api/scenarios")
def scenarios():
    path = DATA / "demo_scenarios.json"
    if not path.exists():
        raise HTTPException(404, "Scenarios not found")
    return _clean_floats(_load_json(path))


@app.get("/api/scenarios/instances")
def scenario_instances():
    path = DATA / "demo_scenario_instances.json"
    if not path.exists():
        raise HTTPException(404, "Scenario instances not found")
    return _clean_floats(_load_json(path))


# ── Cell timeseries ───────────────────────────────────────────────────────────

@app.get("/api/battery/cells/{cell_id}/timeseries")
@app.get("/api/cell/{cell_id}/timeseries")
def cell_timeseries(
    cell_id: int,
    scenario: str | None = Query(None),
    state_kind: str = Query("aged"),
):
    path = DATA / "demo_cell_timeseries.csv"
    if not path.exists():
        raise HTTPException(404, "Timeseries data not found")
    df = pd.read_csv(path)
    mask = df["cell_id"] == cell_id
    if scenario:
        mask &= df["scenario_instance_id"] == scenario
    if state_kind != "all":
        state_mask = df["state_kind"] == state_kind
        filtered = df[mask & state_mask]
        if filtered.empty:
            filtered = df[mask]
    else:
        filtered = df[mask]
    if filtered.empty:
        return []
    records = filtered.to_dict(orient="records")
    return _clean_floats(records)


# ── Anomaly localization ───────────────────────────────────────────────────────

@app.get("/api/battery/localization")
@app.get("/api/anomaly/localization")
def localization(scenario: str | None = Query(None)):
    path = DATA / "demo_localization.csv"
    if not path.exists():
        raise HTTPException(404, "Localization data not found")
    df = pd.read_csv(path)
    if scenario:
        df = df[df["scenario_instance_id"] == scenario]
    return _clean_floats(df.to_dict(orient="records"))


# ── PINN predictions ──────────────────────────────────────────────────────────

@app.get("/api/predictions/pinn")
@app.get("/api/pinn/predictions")
def pinn_predictions(seed: int = Query(11)):
    path = DATA / "demo_cell_predictions.csv"
    if not path.exists():
        raise HTTPException(404, "PINN predictions not found")
    df = pd.read_csv(path)
    df = df[df["seed"] == seed]
    return _clean_floats(df.to_dict(orient="records"))


# ── Particle profiles ─────────────────────────────────────────────────────────

@app.get("/api/battery/particle-profiles")
@app.get("/api/pinn/particle-profiles")
def particle_profiles(scenario: str | None = Query(None)):
    path = DATA / "demo_particle_profiles.csv"
    if not path.exists():
        raise HTTPException(404, "Particle profiles not found")
    df = pd.read_csv(path)
    if scenario:
        df = df[df["scenario_instance_id"] == scenario]
    return _clean_floats(df.to_dict(orient="records"))


# ── Interventions ─────────────────────────────────────────────────────────────

@app.get("/api/battery/interventions")
@app.get("/api/intervention/summary")
def interventions():
    path = DATA / "demo_interventions.json"
    if not path.exists():
        raise HTTPException(404, "Intervention data not found")
    return _clean_floats(_load_json(path))


# ── Event log ─────────────────────────────────────────────────────────────────

@app.get("/api/battery/events")
@app.get("/api/events")
def event_log():
    path = DATA / "demo_event_log.json"
    if not path.exists():
        raise HTTPException(404, "Event log not found")
    return _clean_floats(_load_json(path))


# ── Model registry ────────────────────────────────────────────────────────────

class ModelEntry(BaseModel):
    name: str
    family: str
    status: str
    checkpoint_path: str | None
    input_dim: int | None
    contract_note: str


MODEL_REGISTRY: list[ModelEntry] = [
    ModelEntry(
        name="PyBaMM V1 Pack Generator",
        family="Electrochemical Simulation",
        status="SIMULATION_REFERENCE_SOURCE",
        checkpoint_path=None,
        input_dim=None,
        contract_note="DFN+OKane2022 simulation; outputs stored as CSVs. NOT a checkpointed neural network.",
    ),
    ModelEntry(
        name="PC-MP-PINN seed 11",
        family="PC-MP-PINN",
        status="PRECOMPUTED_OUTPUT_ONLY",
        checkpoint_path=str(PROJECT / "pinn_seed_11.pt") if (PROJECT / "pinn_seed_11.pt").exists() else None,
        input_dim=4,
        contract_note="Single-cell; test predictions at 1.25C/20°C only",
    ),
    ModelEntry(
        name="PC-MP-PINN seed 22",
        family="PC-MP-PINN",
        status="PRECOMPUTED_OUTPUT_ONLY",
        checkpoint_path=str(PROJECT / "pinn_seed_22.pt") if (PROJECT / "pinn_seed_22.pt").exists() else None,
        input_dim=4,
        contract_note="Single-cell; test predictions at 1.25C/20°C only",
    ),
    ModelEntry(
        name="PC-MP-PINN seed 33",
        family="PC-MP-PINN",
        status="PRECOMPUTED_OUTPUT_ONLY",
        checkpoint_path=str(PROJECT / "pinn_seed_33.pt") if (PROJECT / "pinn_seed_33.pt").exists() else None,
        input_dim=4,
        contract_note="Single-cell; test predictions at 1.25C/20°C only",
    ),
    ModelEntry(
        name="B1 Data-only v2",
        family="V1 Future-SOH Predictor",
        status="CONTRACT_UNRESOLVED",
        checkpoint_path=str(PROJECT / "B1_data_only_v2_best.pt") if (PROJECT / "B1_data_only_v2_best.pt").exists() else None,
        input_dim=None,
        contract_note="Manifest says 7 inputs; config_v2 says 8 (adds horizon_s); blocked",
    ),
    ModelEntry(
        name="B3 Physics-domain v2",
        family="V1 Future-SOH Predictor",
        status="CONTRACT_UNRESOLVED",
        checkpoint_path=str(PROJECT / "B3_physics_domain_v2_best.pt") if (PROJECT / "B3_physics_domain_v2_best.pt").exists() else None,
        input_dim=None,
        contract_note="Same input-dimension ambiguity as B1",
    ),
    ModelEntry(
        name="Signal-Statistics Detector",
        family="Anomaly Detection",
        status="PRECOMPUTED_OUTPUT_ONLY",
        checkpoint_path=None,
        input_dim=None,
        contract_note="Frozen threshold=4.399034460052955; outputs in 08_family_holdout_cell_predictions.csv",
    ),
]


@app.get("/api/models")
def model_registry():
    return [m.model_dump() for m in MODEL_REGISTRY]
