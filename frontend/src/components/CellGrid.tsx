import { type CellSnapshot, type RiskLevel, cellRisk, RISK_COLORS } from "../types";

interface Props {
  cells: CellSnapshot[];
  faultCells: number[];
  selectedCell: number;
  onSelectCell: (id: number) => void;
  onDropCell?: (id: number) => void;
}

const RISK_CLASS: Record<RiskLevel, string> = {
  normal:      "ring-0 opacity-90",
  watch:       "ring-1 ring-amber-400 opacity-100",
  warning:     "ring-2 ring-warning-400 opacity-100",
  critical:    "ring-2 ring-danger-400 opacity-100 animate-pulse",
  unavailable: "opacity-40",
};

export default function CellGrid({ cells, faultCells, selectedCell, onSelectCell, onDropCell }: Props) {
  const cellMap = new Map(cells.map(c => [c.cell_id, c]));

  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(10, 1fr)" }}>
      {Array.from({ length: 100 }, (_, i) => i + 1).map(cid => {
        const cell = cellMap.get(cid);
        const risk: RiskLevel = cell?.what_if_risk ?? (cell ? cellRisk(cell, faultCells) : "unavailable");
        const isSelected = cid === selectedCell;
        const isFault = faultCells.includes(cid);

        return (
          <button
            key={cid}
            onClick={() => onSelectCell(cid)}
            onDragOver={onDropCell ? e => e.preventDefault() : undefined}
            onDrop={onDropCell ? e => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData("text/plain"));
              if (id === 0) onDropCell(cid);
            } : undefined}
            title={`Cell ${cid}${isFault ? " ⚠ Fault" : ""}${cell ? ` | T=${(cell.cell_temperature_K - 273.15).toFixed(1)}°C | V=${cell.cell_voltage_V.toFixed(3)}V | SOH=${(cell.capacity_retention_soh * 100).toFixed(2)}%` : ""}`}
            className={`
              aspect-square rounded flex items-center justify-center
              text-[9px] font-bold text-white/90 cursor-pointer
              transition-all duration-100 hover:scale-110 hover:z-10 relative
              ${RISK_CLASS[risk]}
              ${isSelected ? "ring-2 ring-white scale-110 z-10" : ""}
            `}
            style={{ backgroundColor: RISK_COLORS[risk] }}
          >
            {cid}
          </button>
        );
      })}
    </div>
  );
}
