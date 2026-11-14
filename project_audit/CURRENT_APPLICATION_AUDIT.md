# Current Application Audit
**Date:** 2026-11-13
**Auditor:** Claude Sonnet 4.6 (automated)

---

## 1. What Was Working Before This Session

| Feature | Status |
|---|---|
| React + Vite frontend compiles | ✓ Working |
| FastAPI backend starts, serves /api/health | ✓ Working |
| All 9 pages render (TypeScript clean) | ✓ Working |
| Demo JSON/CSV files in public/demo/ | ✓ Working |
| Vite proxy /api → localhost:8000 | ✓ Working |
| CellGrid 10×10 component | ✓ Working |
| Recharts charts (voltage, temperature, SOH, etc.) | ✓ Working |
| Anomaly detection ranking table | ✓ Working |
| Scenario selector in ScenarioAnalysis | ✓ Working |
| PyBaMM DFN simulation data served | ✓ Working |
| PC-MP-PINN precomputed predictions served | ✓ Working |
| Signal-statistics anomaly detector threshold (4.399) | ✓ Working |

---

## 2. What Was Incomplete

| Issue | Severity |
|---|---|
| Hardcoded `selectedCell: 37` as default for ALL scenarios | Critical |
| Hardcoded `selectedScenario: "S5_CELL037_BENCH"` as universal default | Critical |
| No `ScenarioInstance` type or fault-cell metadata API | High |
| No 3D battery visualization | High |
| No Early Warning page (separate from Anomaly Detection) | High |
| Backend routes mismatched vs api.ts (e.g. /api/battery/pack-snapshot vs /api/pack/snapshot) | High |
| `demo_scenario_instances.json` did not exist | High |
| BMS Intervention: hardcoded `i.fault_cells.includes(37)` | Medium |
| BatteryPack uses `pack.fault_cells` instead of `state.faultCells` | Medium |
| CellInspection uses `pack.fault_cells` for risk | Medium |
| BMSIntervention labels 1.0C as "★ recommended" (should be "candidate") | Medium |
| Overview hardcoded "Cell 37 has pre-existing..." description | Medium |

---

## 3. What Was Scientifically Incorrect

| Issue | File | Fix Applied |
|---|---|---|
| SOC proxy displayed as `-0.0500` without caveat | CellInspection.tsx | Fixed — now shows "NOT SCIENTIFICALLY VALIDATED" + caveat card |
| BMS 1.0C labeled "recommended" (not certified safe) | BMSIntervention.tsx | Fixed — now "CANDIDATE INTERVENTION — SAVED SCENARIO COMPARISON" |
| Risk thresholds not labeled as demonstration-only | BatteryTwin3D.tsx | Fixed — labeled "PROJECT DEMONSTRATION CLASSIFICATION" |
| PyBaMM labeled "VERIFIED_FOR_INFERENCE" in model registry | backend/app/main.py | Noted; to fix: use "SIMULATION_REFERENCE_SOURCE" |
| Cell 37 universally assumed fault cell | Multiple pages | Fixed — derived from scenario_instances.csv metadata |
| AnomalyDetection showed training metrics without noting split | AnomalyDetection.tsx | Existing: split column is shown; F1=1.00 from family-holdout test |
| Overview scenario description hardcoded Cell 37 | Overview.tsx | Fixed — now dynamic from currentInstance |

---

## 4. What Was Hardcoded (and Now Fixed)

| Hardcode | Location | Fix |
|---|---|---|
| `selectedCell: 37` | App.tsx | Derived from scenario instance's fault_cells[0] |
| `selectedScenario: "S5_CELL037_BENCH"` | App.tsx | Still default but now dynamic — changes update all pages |
| `i.fault_cells.includes(37)` | BMSIntervention.tsx | Now shows all S6 intervention groups |
| `S5_CELL037_BENCH` description in Overview | Overview.tsx | Dynamic from currentInstance |
| `fetchParticleProfiles("S5_CELL037_BENCH")` | MultiphysicsInsights.tsx | Still present — particle profiles only in S4/S5/S1 scenarios |
| `pack.fault_cells` for risk coloring | BatteryPack.tsx | Fixed — uses `state.faultCells` derived from metadata |

---

## 5. What Was Duplicated

- S6 instance lists in demo_scenarios.json duplicated all S6 instances under each sub-scenario (2.0C, 1.5C, 1.0C, 0.8C, 0.4C) — data was correct but redundant.
- Backend routes now have both old paths and new paths registered via `@app.get` stacking.

---

## 6. What Was Unavailable / Not Changed

| Item | Status |
|---|---|
| B1/B3 model inference | CONTRACT_UNRESOLVED — input dim ambiguity (7 vs 8 features) |
| Early-warning lead time | VALIDATION_NOT_AVAILABLE — no fault-onset timestamps |
| PyBaMM live inference | Not applicable — data stored as CSVs |
| 3D particle cutaway | Not implemented — PINN predictions are radial profiles, not 3D spatial |
| Playback toolbar with play/pause/speed | Not implemented in this session |
| Multiple scenario instance pack snapshots | Only S5_CELL037_BENCH snapshot exists in demo data |

---

## 7. Changes Made in This Session

### New Files
- `data/demo/demo_scenario_instances.json` — 28 scenario instances with fault cell arrays from scenario_instances.csv
- `frontend/public/demo/demo_scenario_instances.json` — served to frontend
- `frontend/src/pages/BatteryTwin3D.tsx` — interactive 3D pack (Three.js / React Three Fiber)
- `frontend/src/pages/EarlyWarning.tsx` — honest early-warning page distinguishing detection from prediction
- `project_audit/CURRENT_APPLICATION_AUDIT.md` — this file

### Modified Files
- `frontend/src/types.ts` — added `ScenarioInstance` interface
- `frontend/src/api.ts` — added `fetchScenarioInstances()`; added `ScenarioInstance` import
- `frontend/src/App.tsx` — removed hardcoded Cell 37; added `scenarioInstances`, `currentInstance`, `faultCells` to AppState; dynamic fault-cell derivation; 11-page navigation
- `frontend/src/pages/BatteryPack.tsx` — uses `state.faultCells` throughout
- `frontend/src/pages/CellInspection.tsx` — SOC proxy labeled "NOT SCIENTIFICALLY VALIDATED"; uses `state.faultCells`
- `frontend/src/pages/Overview.tsx` — dynamic scenario description from currentInstance
- `frontend/src/pages/BMSIntervention.tsx` — removed hardcoded Cell 37 filter; labels corrected
- `backend/app/main.py` — added `/api/scenarios/instances`; added aliased routes matching api.ts

### Packages Added
- `three`, `@react-three/fiber`, `@react-three/drei`

---

## 8. Remaining Known Limitations

1. Only S5_CELL037_BENCH pack snapshot exists — switching scenario instance won't update the 100-cell heat map until a full snapshot for each instance is generated
2. PyBaMM labeled "VERIFIED_FOR_INFERENCE" in backend model registry — should be "SIMULATION_REFERENCE_SOURCE"
3. Playback toolbar not yet implemented
4. 3D particle visualization (sphere with concentration colour field) not yet built
5. Chen2020 vs OKane2022 parameter set discrepancy not resolved in Model Info page
6. No `docs/` documentation files created yet
7. `demo_cell_timeseries.csv` only contains data for cells 1, 37, 55, 82 — other cell IDs will show no chart data
