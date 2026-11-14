/**
 * API client — tries FastAPI backend first, falls back to local demo JSON files.
 */
import type {
  PackSnapshot, CellTimeseriesRow, LocalizationRow, PinnPrediction,
  InterventionRecord, ScenarioInfo, EventLogEntry, ScenarioInstance
} from "./types";

const API_BASE = "http://localhost:8000";
const DEMO_BASE = "/demo";  // served by Vite from public/demo/

async function apiFetch<T>(path: string, fallback: string): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  } catch {
    const res = await fetch(`${DEMO_BASE}${fallback}`);
    if (!res.ok) throw new Error(`Demo data not found: ${fallback}`);
    return res.json();
  }
}

export async function fetchPackSnapshot(scenarioId?: string): Promise<PackSnapshot> {
  const q = scenarioId ? `?scenario=${scenarioId}` : "";
  return apiFetch<PackSnapshot>(`/api/battery/pack-snapshot${q}`, "/demo_pack_snapshot.json");
}

export async function fetchScenarios(): Promise<ScenarioInfo[]> {
  return apiFetch<ScenarioInfo[]>("/api/scenarios", "/demo_scenarios.json");
}

export async function fetchScenarioInstances(): Promise<ScenarioInstance[]> {
  return apiFetch<ScenarioInstance[]>("/api/scenarios/instances", "/demo_scenario_instances.json");
}

export async function fetchEventLog(): Promise<EventLogEntry[]> {
  return apiFetch<EventLogEntry[]>("/api/battery/events", "/demo_event_log.json");
}

export async function fetchInterventions(): Promise<InterventionRecord[]> {
  return apiFetch<InterventionRecord[]>("/api/battery/interventions", "/demo_interventions.json");
}

// CSV parsers for demo files
function parseCSV<T>(text: string): T[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    const obj: Record<string, string | number | boolean> = {};
    headers.forEach((h, i) => {
      const v = vals[i]?.trim() ?? "";
      if (v === "True") obj[h] = true;
      else if (v === "False") obj[h] = false;
      else if (!isNaN(Number(v)) && v !== "") obj[h] = Number(v);
      else obj[h] = v;
    });
    return obj as T;
  });
}

export async function fetchCellTimeseries(cellId: number, scenario?: string): Promise<CellTimeseriesRow[]> {
  try {
    const path = `/api/battery/cells/${cellId}/timeseries${scenario ? `?scenario=${scenario}` : ""}`;
    const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error("API unavailable");
    return res.json();
  } catch {
    const res = await fetch(`${DEMO_BASE}/demo_cell_timeseries.csv`);
    const text = await res.text();
    const all = parseCSV<CellTimeseriesRow>(text);
    return all.filter(r => r.cell_id === cellId && (!scenario || r.scenario_instance_id === scenario));
  }
}

export async function fetchLocalization(scenario?: string): Promise<LocalizationRow[]> {
  try {
    const path = `/api/battery/localization${scenario ? `?scenario=${scenario}` : ""}`;
    const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error("API unavailable");
    return res.json();
  } catch {
    const res = await fetch(`${DEMO_BASE}/demo_localization.csv`);
    const text = await res.text();
    const all = parseCSV<LocalizationRow>(text);
    return scenario ? all.filter(r => r.scenario_instance_id === scenario) : all;
  }
}

export async function fetchPinnPredictions(seed?: number): Promise<PinnPrediction[]> {
  try {
    const path = `/api/predictions/pinn${seed ? `?seed=${seed}` : ""}`;
    const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error("API unavailable");
    return res.json();
  } catch {
    const res = await fetch(`${DEMO_BASE}/demo_cell_predictions.csv`);
    const text = await res.text();
    const all = parseCSV<PinnPrediction>(text);
    return seed ? all.filter(r => r.seed === seed) : all;
  }
}

export async function fetchParticleProfiles(scenario?: string): Promise<Record<string, unknown>[]> {
  try {
    const path = `/api/battery/particle-profiles${scenario ? `?scenario=${scenario}` : ""}`;
    const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error("API unavailable");
    return res.json();
  } catch {
    const res = await fetch(`${DEMO_BASE}/demo_particle_profiles.csv`);
    const text = await res.text();
    return parseCSV(text);
  }
}
