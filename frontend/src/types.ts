export interface CellSnapshot {
  cell_id: number;
  scenario_instance_id: string;
  time_s: number;
  cell_voltage_V: number;
  cell_current_A: number;
  cell_temperature_K: number;
  surface_temperature_K: number;
  soc_proxy: number;
  capacity_retention_soh: number;
  dc_pulse_resistance_proxy_ohm: number;
  is_fault_cell: boolean;
  fault_declared: boolean;
  what_if_temperature_K?: number;
  what_if_voltage_V?: number;
  what_if_resistance_ohm?: number;
  what_if_soh?: number;
  what_if_radial_stress_MPa?: number;
  what_if_tangential_stress_MPa?: number;
  what_if_concentration_deviation?: number;
  what_if_risk?: RiskLevel;
}

export interface PackSnapshot {
  scenario_instance_id: string;
  scenario_id: string;
  cycle: number;
  cell_count: number;
  fault_cells: number[];
  cells: CellSnapshot[];
}

export interface CellTimeseriesRow {
  scenario_instance_id: string;
  cell_id: number;
  state_kind: string;
  ageing_cycles: number;
  time_s: number;
  cell_voltage_V: number;
  cell_current_A: number;
  cell_temperature_K: number;
  surface_temperature_K: number;
  soc_proxy: number;
  capacity_retention_soh: number;
  requested_charge_rate_C: number;
  ambient_temperature_C: number;
  dc_pulse_resistance_proxy_ohm: number;
}

export interface LocalizationRow {
  scenario_instance_id: string;
  cell_id: number;
  signal_anomaly_score: number;
  signal_rank: number;
  evaluation_split: string;
  has_fault: boolean;
  is_fault: number;
  predicted_fault: boolean;
  family_key: string;
}

export interface PinnPrediction {
  c_rate: number;
  T_amb_C: number;
  r_norm: number;
  t_norm: number;
  c_mol_m3: number;
  pred_c_mol_m3: number;
  pred_T_rise_K: number;
  sigma_r_MPa: number;
  sigma_t_MPa: number;
  seed: number;
  split: string;
  cond_id: number;
}

export interface InterventionRecord {
  scenario_instance_id: string;
  base_scenario: string;
  candidate_charge_rate_C: number;
  fault_cells: number[];
  max_pack_voltage_V: number;
  min_pack_voltage_V: number;
  max_abs_current_A: number;
  avg_cell_voltage_V: number;
  est_peak_temp_K: number;
  source: string;
}

export interface ScenarioInfo {
  scenario_id: string;
  sub_id: string;
  name: string;
  ambient_temp_c: number;
  charge_rate_c: number;
  initial_soc: number;
  degradation_state: string;
  purpose: string;
  instances: string[];
}

export interface ScenarioInstance {
  scenario_instance_id: string;
  scenario_id: string;
  split: string;
  cell_count: number;
  fault_cells: number[];
  fault_count: number;
  cell37_is_benchmark: boolean;
  degradation_source: string;
  base_scenario_instance_id: string | null;
  candidate_charge_rate_C: number | null;
}

export type FaultMechanism =
  | "thermal"
  | "tangential_stress"
  | "radial_stress"
  | "concentration"
  | "voltage"
  | "resistance"
  | "capacity"
  | "combined";

export interface WhatIfFault {
  cellId: number;
  mechanism: FaultMechanism;
  severity: number;
  threshold: number;
  startTimeS: number;
  durationS: number;
}

export interface SimulationState {
  status: "idle" | "running" | "paused" | "complete";
  timeS: number;
  speed: number;
}

export interface SimulationEvent {
  id: string;
  timeS: number;
  type: "fault_assigned" | "fault_activated" | "threshold_crossed" | "risk_changed" | "fault_removed" | "simulation_paused" | "simulation_resumed" | "simulation_reset";
  cellId?: number;
  description: string;
}

export function whatIfCellActive(fault: WhatIfFault, timeS: number): boolean {
  return timeS >= fault.startTimeS && timeS <= fault.startTimeS + fault.durationS;
}

export const FAULT_MECHANISMS: { value: FaultMechanism; label: string; unit: string; description: string }[] = [
  { value: "thermal", label: "Thermal overheating", unit: "°C", description: "Raises the illustrative cell temperature after activation." },
  { value: "tangential_stress", label: "Tangential stress", unit: "MPa", description: "Increases the derived tangential stress proxy." },
  { value: "radial_stress", label: "Radial stress", unit: "MPa", description: "Increases the derived radial stress proxy." },
  { value: "concentration", label: "Lithium concentration", unit: "mol/m³", description: "Applies a concentration-deviation proxy to the cell response." },
  { value: "voltage", label: "Voltage deviation", unit: "V", description: "Applies a voltage deviation to the illustrative response." },
  { value: "resistance", label: "Resistance increase", unit: "mΩ", description: "Raises the resistance proxy and reduces voltage." },
  { value: "capacity", label: "Capacity degradation", unit: "%", description: "Reduces the illustrative SOH value." },
  { value: "combined", label: "Combined multiphysics", unit: "severity", description: "Applies the coupled illustrative effects above." },
];

export interface EventLogEntry {
  timestamp: string;
  event_type: string;
  cell_id: number | null;
  scenario: string;
  description: string;
  source: string;
}

export type RiskLevel = "normal" | "watch" | "warning" | "critical" | "unavailable";

export function cellRisk(cell: CellSnapshot, faultCells: number[]): RiskLevel {
  const tempC = cell.cell_temperature_K - 273.15;
  if (faultCells.includes(cell.cell_id)) {
    if (tempC > 50) return "critical";
    if (tempC > 42) return "warning";
    return "watch";
  }
  if (tempC > 55) return "critical";
  if (tempC > 48) return "warning";
  if (tempC > 40) return "watch";
  return "normal";
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  normal: "#3b82f6",
  watch: "#fbbf24",
  warning: "#f97316",
  critical: "#ef4444",
  unavailable: "#374151",
};

export const RISK_BG: Record<RiskLevel, string> = {
  normal: "bg-electric-500",
  watch: "bg-amber-400",
  warning: "bg-warning-400",
  critical: "bg-danger-500",
  unavailable: "bg-slate-700",
};
