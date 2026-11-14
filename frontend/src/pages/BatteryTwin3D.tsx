import { useRef, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Text } from "@react-three/drei";
import * as THREE from "three";
import type { AppState } from "../App";
import { RISK_COLORS, cellRisk } from "../types";
import type { CellSnapshot, RiskLevel } from "../types";

interface Props { state: AppState; setSelectedCell: (id: number) => void; setSelectedScenario: (id: string) => void; }

// ── Cell 3D Mesh ──────────────────────────────────────────────────────────────
const CELL_W = 0.8, CELL_H = 2.2, CELL_D = 0.8, GAP = 0.25;

interface CellMeshProps {
  cell: CellSnapshot;
  risk: RiskLevel;
  isFault: boolean;
  isSelected: boolean;
  position: [number, number, number];
  onSelect: (id: number) => void;
}

function CellMesh({ cell, risk, isFault, isSelected, position, onSelect }: CellMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = useMemo(() => new THREE.Color(RISK_COLORS[risk]), [risk]);
  const faultColor = new THREE.Color("#ef4444");

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (isFault) {
      // Fault cells pulse
      const pulse = 0.85 + Math.sin(clock.getElapsedTime() * 3) * 0.15;
      meshRef.current.scale.setScalar(pulse);
    } else if (isSelected) {
      meshRef.current.scale.setScalar(1.05);
    } else {
      meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    }
  });

  const tempC = cell.cell_temperature_K - 273.15;
  const soh = (cell.capacity_retention_soh * 100).toFixed(1);

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={() => onSelect(cell.cell_id)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[CELL_W, CELL_H, CELL_D]} />
        <meshStandardMaterial
          color={isFault ? faultColor : color}
          emissive={isFault ? faultColor : (isSelected ? color : new THREE.Color("#000"))}
          emissiveIntensity={isFault ? 0.4 : isSelected ? 0.3 : hovered ? 0.15 : 0}
          metalness={0.3}
          roughness={0.5}
          transparent
          opacity={hovered ? 1.0 : 0.95}
        />
      </mesh>

      {/* Terminal cap */}
      <mesh position={[0, CELL_H / 2 + 0.07, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.14, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
          <ringGeometry args={[0.52, 0.56, 32]} />
          <meshBasicMaterial color="#22d3ee" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Fault ring */}
      {isFault && (
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[0.54, 0.6, 32]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Cell ID label */}
      <Text
        position={[0, -CELL_H / 2 - 0.2, 0]}
        fontSize={0.12}
        color={isFault ? "#fca5a5" : isSelected ? "#7dd3fc" : "#64748b"}
        anchorX="center"
        anchorY="top"
        font={undefined}
      >
        {cell.cell_id}
      </Text>

      {/* Hover tooltip */}
      {hovered && (
        <Html position={[0.6, 0.5, 0]} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "#0a1929", border: "1px solid #2d3c52", borderRadius: 8,
            padding: "8px 10px", fontSize: 11, color: "#cbd5e1", whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)"
          }}>
            <div style={{ fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>Cell {cell.cell_id}</div>
            <div>T: <b style={{ color: tempC > 50 ? "#f87171" : "#fbbf24" }}>{tempC.toFixed(1)}°C</b></div>
            <div>V: <b style={{ color: "#7dd3fc" }}>{cell.cell_voltage_V.toFixed(3)} V</b></div>
            <div>I: <b style={{ color: "#a78bfa" }}>{cell.cell_current_A.toFixed(2)} A</b></div>
            <div>SOH: <b style={{ color: "#34d399" }}>{soh}%</b></div>
            <div>SOC: <b style={{ color: "#f59e0b" }}>NOT VALIDATED</b></div>
            <div style={{ marginTop: 4, fontSize: 10 }}>
              <span style={{
                padding: "1px 6px", borderRadius: 4,
                background: isFault ? "#7f1d1d" : "#1e3a5f",
                color: isFault ? "#fca5a5" : "#93c5fd"
              }}>
                {isFault ? "⚠ DECLARED FAULT" : risk.toUpperCase()}
              </span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Pack floor ────────────────────────────────────────────────────────────────
function PackEnclosure() {
  const W = 10 * (CELL_W + GAP) + 0.4;
  const D = 10 * (CELL_D + GAP) + 0.4;
  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -CELL_H / 2 - 0.15, 0]} receiveShadow>
        <boxGeometry args={[W, 0.1, D]} />
        <meshStandardMaterial color="#0a1929" metalness={0.1} roughness={0.9} />
      </mesh>
      {/* Frame lines */}
      {[[-W / 2, -W / 2 + 0.05], [W / 2 - 0.05, W / 2]].map((_, i) => (
        <mesh key={i} position={[i === 0 ? -W / 2 + 0.025 : W / 2 - 0.025, 0, 0]}>
          <boxGeometry args={[0.05, CELL_H + 0.4, D]} />
          <meshStandardMaterial color="#1e3a5f" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ── Main 3D scene ──────────────────────────────────────────────────────────────
function PackScene({ cells, faultCells, selectedCell, onSelect }: {
  cells: CellSnapshot[];
  faultCells: number[];
  selectedCell: number;
  onSelect: (id: number) => void;
}) {
  const cellMap = useMemo(() => {
    const m: Record<number, CellSnapshot> = {};
    cells.forEach(c => { m[c.cell_id] = c; });
    return m;
  }, [cells]);

  const COLS = 10, ROWS = 10;
  const totalW = COLS * (CELL_W + GAP) - GAP;
  const totalD = ROWS * (CELL_D + GAP) - GAP;

  // Build 100 cells (use dummy placeholder if data not available for that id)
  const cellList = useMemo(() => {
    return Array.from({ length: 100 }, (_, i) => i + 1).map(id => {
      return cellMap[id] ?? {
        cell_id: id, scenario_instance_id: "", time_s: 0,
        cell_voltage_V: 3.6, cell_current_A: 0, cell_temperature_K: 298,
        surface_temperature_K: 298, soc_proxy: 0, capacity_retention_soh: 1,
        dc_pulse_resistance_proxy_ohm: 0.02, is_fault_cell: false, fault_declared: false
      };
    });
  }, [cellMap]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-8, 8, -8]} intensity={0.5} color="#3b82f6" />
      <pointLight position={[8, 8, 8]} intensity={0.3} color="#22d3ee" />

      <PackEnclosure />

      {cellList.map((cell, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = col * (CELL_W + GAP) - totalW / 2 + CELL_W / 2;
        const z = row * (CELL_D + GAP) - totalD / 2 + CELL_D / 2;
        const risk = cell.what_if_risk ?? cellRisk(cell, faultCells);
        const isFault = faultCells.includes(cell.cell_id);
        return (
          <CellMesh
            key={cell.cell_id}
            cell={cell}
            risk={risk}
            isFault={isFault}
            isSelected={cell.cell_id === selectedCell}
            position={[x, 0, z]}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
const LEGEND = [
  { color: RISK_COLORS.normal, label: "Normal" },
  { color: RISK_COLORS.watch, label: "Watch (>40°C)" },
  { color: RISK_COLORS.warning, label: "Warning (>48°C)" },
  { color: RISK_COLORS.critical, label: "Critical (>55°C)" },
  { color: "#ef4444", label: "Declared Fault" },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BatteryTwin3D({ state, setSelectedCell, setSelectedScenario }: Props) {
  const { pack, faultCells, declaredFaultCells, activeFaultCells, selectedCell, scenarioInstances, selectedScenario, currentInstance } = state;
  const cells = pack?.cells ?? [];

  // Instance selector — only non-healthy instances with fault cells
  const faultInstances = scenarioInstances.filter(i => i.fault_count > 0);

  const selectedCellData = cells.find(c => c.cell_id === selectedCell);
  const tempC = selectedCellData ? (selectedCellData.cell_temperature_K - 273.15).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-100">3D Battery Digital Twin</h1>
          <p className="text-sm text-slate-500">100-cell pack · PyBaMM DFN simulation data · interactive 3D</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scenario instance selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Instance:</span>
            <select
              value={selectedScenario}
              onChange={e => setSelectedScenario(e.target.value)}
              className="text-xs bg-graphite-800 border border-graphite-600 text-slate-300 rounded px-2 py-1 font-mono"
            >
              {faultInstances.map(i => (
                <option key={i.scenario_instance_id} value={i.scenario_instance_id}>
                  {i.scenario_instance_id} — fault: [{i.fault_cells.join(", ")}]
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Science disclaimer */}
      <div className="card-sm bg-graphite-700/40 border-graphite-500/40 text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-400">Data source:</strong> Cell positions are a 10×10 schematic layout.
        Colours reflect PyBaMM DFN simulation state at the selected snapshot time.
        Temperature thresholds are <strong className="text-warning-400">PROJECT DEMONSTRATION CLASSIFICATION</strong> — not manufacturer-approved safety limits.
        SOC proxy values are not scientifically validated and are excluded from display.
        {currentInstance && (
          <span> · Scenario split: <span className="font-mono text-slate-400">{currentInstance.split}</span></span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 3D canvas */}
        <div className="lg:col-span-3">
          <div className="card" style={{ height: 520, padding: 0, overflow: "hidden" }}>
            <Canvas
              camera={{ position: [0, 10, 16], fov: 50 }}
              shadows
              gl={{ antialias: true }}
              style={{ background: "#050e1a" }}
            >
              <Suspense fallback={null}>
                <PackScene
                  cells={cells}
                  faultCells={faultCells}
                  selectedCell={selectedCell}
                  onSelect={setSelectedCell}
                />
                <OrbitControls
                  enablePan enableZoom enableRotate
                  minDistance={5} maxDistance={40}
                  target={[0, 0, 0]}
                />
              </Suspense>
              <fog attach="fog" args={["#050e1a", 30, 60]} />
            </Canvas>
          </div>
          <div className="text-xs text-slate-600 mt-1 text-center">
            Drag to rotate · Scroll to zoom · Right-drag to pan · Click cell to select
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-3">
          {/* Fault info */}
          <div className={`card ${faultCells.length > 0 ? "border-danger-500/40 bg-danger-500/5" : "border-green-500/30 bg-green-500/5"}`}>
            <div className="text-xs font-bold text-slate-400 mb-2">Declared Fault Cells</div>
            {faultCells.length > 0 ? (
              <div className="space-y-1">
                {faultCells.map(fc => (
                  <div key={fc} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${declaredFaultCells.includes(fc) ? "bg-danger-500" : "bg-amber-400"} ${activeFaultCells.includes(fc) ? "animate-pulse" : ""}`} />
                    <button
                      onClick={() => setSelectedCell(fc)}
                      className="text-danger-400 font-mono font-bold text-sm hover:text-danger-300"
                    >
                      Cell {fc} {declaredFaultCells.includes(fc) ? "(declared)" : "(what-if)"}
                    </button>
                    <span className="text-xs text-slate-600 font-mono">(declared)</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-green-400">No declared fault cells</div>
            )}
            <div className="text-[10px] text-slate-600 mt-2">
              Source: scenario_instances.csv · PyBaMM OKane2022
            </div>
          </div>

          {/* Selected cell */}
          {selectedCellData && (
            <div className="card border-cyan-400/30 bg-cyan-400/5">
              <div className="text-xs font-bold text-cyan-400 mb-2">Selected — Cell {selectedCell}</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Temperature</span>
                  <span className="font-mono text-slate-300">{tempC}°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Voltage</span>
                  <span className="font-mono text-slate-300">{selectedCellData.cell_voltage_V.toFixed(3)} V</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current</span>
                  <span className="font-mono text-slate-300">{selectedCellData.cell_current_A.toFixed(2)} A</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SOH</span>
                  <span className="font-mono text-green-400">{(selectedCellData.capacity_retention_soh * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SOC proxy</span>
                  <span className="font-mono text-warning-400 text-[10px]">NOT VALIDATED</span>
                </div>
                {faultCells.includes(selectedCell) && (
                  <div className="mt-2 p-1.5 bg-danger-500/10 rounded text-[10px] text-danger-400 border border-danger-500/30">
                    ⚠ Declared fault cell for this scenario instance
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="card-sm">
            <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
              Health Legend
            </div>
            <div className="space-y-1.5">
              {LEGEND.map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: l.color }} />
                  <span className="text-xs text-slate-400">{l.label}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-600 mt-2">
              Thresholds: demonstration classification only
            </div>
          </div>

          {/* Instance info */}
          {currentInstance && (
            <div className="card-sm">
              <div className="text-xs font-bold text-slate-400 mb-1">Scenario Instance</div>
              <div className="text-[10px] space-y-0.5 text-slate-500 font-mono">
                <div>{currentInstance.scenario_instance_id}</div>
                <div>Family: {currentInstance.scenario_id}</div>
                <div>Split: {currentInstance.split}</div>
                <div>Faults: {currentInstance.fault_count}</div>
                <div className="text-[9px] text-slate-600 mt-1">OKane2022 coupled ageing</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pack stats strip */}
      {pack && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Cells", value: pack.cell_count, unit: "" },
            { label: "Fault Cells", value: faultCells.length, unit: "", color: faultCells.length > 0 ? "text-danger-400" : "text-green-400" },
            { label: "Avg Temp", value: (pack.cells.reduce((a, c) => a + c.cell_temperature_K, 0) / pack.cells.length - 273.15).toFixed(1), unit: "°C" },
            { label: "Avg SOH", value: (pack.cells.reduce((a, c) => a + c.capacity_retention_soh, 0) / pack.cells.length * 100).toFixed(2), unit: "%" },
          ].map(m => (
            <div key={m.label} className="card-sm">
              <div className="text-xs text-slate-500">{m.label}</div>
              <div className={`text-xl font-bold font-mono ${m.color ?? "text-slate-200"}`}>{m.value}{m.unit}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
