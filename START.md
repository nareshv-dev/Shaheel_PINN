# PINN Digital Twin — Quick Start

## 1. Backend (FastAPI)
```bash
cd e:/Naresh_Projects/pinn_project
pip install -r backend/requirements.txt
python backend/run.py          # starts on http://localhost:8000
# API docs: http://localhost:8000/docs
```

## 2. Frontend (React + Vite)
```bash
cd e:/Naresh_Projects/pinn_project/frontend
npm install                    # first time only
npm run dev                    # starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

## Demo mode (no backend needed)
The frontend falls back to static demo files in `frontend/public/demo/`
when the FastAPI server is not running. All 9 pages display precomputed data.

## Pages
| Path | Page |
|---|---|
| / | Overview — pack summary, risk counts, fault cells |
| /pack | Battery Pack — 10×10 cell grid |
| /cell | Cell Inspection — time-series charts |
| /health | Predictive Health — SOH models, CONTRACT_UNRESOLVED status |
| /multiphysics | Multiphysics Insights — PC-MP-PINN concentration/stress |
| /anomaly | Anomaly Detection — signal-statistics detector |
| /intervention | BMS Intervention — S6 charge-rate sweep |
| /scenarios | Scenario Analysis — S1–S6 matrix |
| /models | Model Information — catalog + known limitations |
