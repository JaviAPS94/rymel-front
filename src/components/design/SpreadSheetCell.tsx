import React, { useState } from "react";
import { Cell, CellGrid } from "./spreadsheet-types";
import InlineCellGraphic from "./InlineCellGraphic";

interface SpreadSheetCellProps {
  cellRef: string;
  cell: Cell | undefined;
  isSelected: boolean;
  isHidden: boolean;
  isFrozen: boolean;
  isAddingToFormula: boolean;
  rangeSelectionStart: string | null;
  columnWidth: number;
  rowHeight: number;
  onCellClick: (cellRef: string, event?: React.MouseEvent) => void;
  onCellContextMenu: (e: React.MouseEvent, cellRef: string) => void;
  onCellValueChange?: (cellRef: string, value: string) => void;
  isEditing: boolean;
  editingValue: string;
  onStartEditing?: (cellRef: string) => void;
  onStopEditing?: (value: string) => void;
  onNavigateAfterEdit?: (direction: "down" | "right") => void;
  cells: CellGrid; // Add cells prop for graphics
  fontScale?: number; // Zoom scale factor (1.0 = 100%)
}

const SpreadSheetCell: React.FC<SpreadSheetCellProps> = ({
  cellRef,
  cell,
  isSelected,
  isHidden,
  isFrozen,
  isAddingToFormula,
  rangeSelectionStart,
  columnWidth,
  rowHeight,
  onCellClick,
  onCellContextMenu,
  onCellValueChange,
  isEditing,
  editingValue,
  onStartEditing,
  onStopEditing,
  onNavigateAfterEdit,
  cells,
  fontScale = 1,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Check if this cell should display a graphic
  const cellValue = cell?.value || "";
  const isGraphicCell =
    typeof cellValue === "string" && cellValue.startsWith("DRAW:");

  let graphicView: "FRONTAL" | "SUPERIOR" | null = null;
  let graphicComponents: Array<"NUCLEO" | "BOBINA" | "TANQUE"> = [];
  let dimensionCells = {};

  if (isGraphicCell) {
    const parts = cellValue.split(":");
    if (parts.length >= 3) {
      const view = parts[1].toUpperCase();
      if (view === "FRONTAL" || view === "SUPERIOR") {
        graphicView = view as "FRONTAL" | "SUPERIOR";

        // Parse components (comma-separated)
        const componentsStr = parts[2].toUpperCase();
        const componentsList = componentsStr.split(",").map((c) => c.trim());

        for (const comp of componentsList) {
          if (comp === "NUCLEO" || comp === "BOBINA" || comp === "TANQUE") {
            graphicComponents.push(comp);
          }
        }

        // Parse dimension cell references if provided (optional)
        // Format: DRAW:VIEW:COMPONENTS:nucleoAlto,nucleoAncho:bobinaProfundidad:tanqueAlto,tanqueDiametro
        if (parts.length >= 4) {
          const nucleoCells = parts[3]?.split(",") || [];
          const bobinaCells = parts[4]?.split(",") || [];
          const tanqueCells = parts[5]?.split(",") || [];

          dimensionCells = {
            nucleo: {
              alto: nucleoCells[0],
              ancho: nucleoCells[1],
            },
            bobina: {
              profundidad: bobinaCells[0],
            },
            tanque: {
              alto: tanqueCells[0],
              diametro: tanqueCells[1],
            },
          };
        }
      }
    }
  }

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  // Sync input value when editingValue changes (e.g., from formula bar)
  React.useEffect(() => {
    if (
      isEditing &&
      inputRef.current &&
      inputRef.current.value !== editingValue
    ) {
      const cursorPosition = inputRef.current.selectionStart || 0;
      inputRef.current.value = editingValue;
      // Restore cursor position
      inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
    }
  }, [editingValue, isEditing]);
  // Check if this cell has dropdown options
  const hasOptions = cell?.options && cell.options.length > 0;

  // Evaluate conditional formatting: highlight when value is outside [min, max]
  const conditionalBgColor = (() => {
    const cf = cell?.conditionalFormat;
    if (!cf) return undefined;
    const v =
      typeof cell?.computed === "number"
        ? cell.computed
        : parseFloat(String(cell?.computed ?? ""));
    if (isNaN(v)) return undefined;
    const belowMin = cf.min !== undefined && v < cf.min;
    const aboveMax = cf.max !== undefined && v > cf.max;
    return belowMin || aboveMax ? cf.color : undefined;
  })();

  // Compute style from cell properties
  const cellStyle: React.CSSProperties = {
    width: columnWidth,
    height: rowHeight,
    minWidth: columnWidth,
    minHeight: rowHeight,
    maxWidth: columnWidth,
    maxHeight: rowHeight,
    fontSize: Math.round(14 * fontScale),
    fontWeight: cell?.bold ? "bold" : undefined,
    color: cell?.textColor || undefined,
    backgroundColor:
      conditionalBgColor ||
      cell?.backgroundColor ||
      (isFrozen ? "#ffffff" : undefined),
    boxSizing: "border-box",
    borderTop: "none", // Remove top border to avoid doubling with row above
    borderLeft: "none", // Remove left border to avoid doubling with column to left
    borderRight: "1px solid #e5e7eb", // Default grid border
    borderBottom: "1px solid #e5e7eb", // Default grid border
  };

  // Apply custom border if specified (use individual properties to avoid React warnings)
  if (cell?.border) {
    cellStyle.borderTop = cell.border;
    cellStyle.borderLeft = cell.border;
    cellStyle.borderRight = cell.border;
    cellStyle.borderBottom = cell.border;
  }

  // Selection styling - use box-shadow instead of ring to avoid layout shift
  if (isSelected) {
    cellStyle.boxShadow = "inset 0 0 0 2px #3b82f6";
    cellStyle.backgroundColor = cell?.backgroundColor || "#eff6ff";
  } else if (rangeSelectionStart === cellRef) {
    cellStyle.boxShadow = "inset 0 0 0 2px #f97316";
    cellStyle.backgroundColor = cell?.backgroundColor || "#fed7aa";
  } else if (isAddingToFormula) {
    // Light green tint for hoverable cells in formula mode
    cellStyle.backgroundColor = cell?.backgroundColor;
  }

  return (
    <div
      className={`relative cursor-pointer ${
        isAddingToFormula && !isSelected
          ? "hover:bg-green-50 hover:shadow-[inset_0_0_0_2px_#10b981]"
          : !isSelected && rangeSelectionStart !== cellRef
            ? "hover:bg-gray-50"
            : ""
      }`}
      style={cellStyle}
      onClick={(e) => onCellClick(cellRef, e)}
      onContextMenu={(e) => onCellContextMenu(e, cellRef)}
    >
      {isHidden ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300">
          <button
            className="flex flex-col items-center justify-center gap-1 p-2 hover:bg-gray-200 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onCellContextMenu(e as any, cellRef);
            }}
            title="Expandir celda"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="text-xs text-gray-500 font-medium">{cellRef}</span>
          </button>
        </div>
      ) : hasOptions ? (
        // Render select dropdown when cell has options
        <div className="w-full h-full flex items-center px-1 relative">
          <select
            value={cell?.computed?.toString() || ""}
            onChange={(e) => {
              e.stopPropagation();
              if (onCellValueChange) {
                onCellValueChange(cellRef, e.target.value);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-full text-sm border-none bg-transparent focus:outline-none focus:ring-0 cursor-pointer pr-6 appearance-none"
            style={{
              fontWeight: cell?.bold ? "bold" : undefined,
              color: cell?.textColor || undefined,
            }}
          >
            <option value="">-- Seleccionar --</option>
            {(cell?.options || []).map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
          {/* Dropdown indicator */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-gray-400 flex-shrink-0 absolute right-1 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      ) : isEditing ? (
        // Inline editing mode - show input directly in cell (UNCONTROLLED for performance)
        <input
          ref={inputRef}
          type="text"
          defaultValue={editingValue}
          onBlur={() => {
            if (onStopEditing && inputRef.current) {
              onStopEditing(inputRef.current.value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (onStopEditing && inputRef.current) {
                onStopEditing(inputRef.current.value);
              }
              // Navigate down after stopping edit
              setTimeout(() => {
                if (onNavigateAfterEdit) {
                  onNavigateAfterEdit("down");
                }
              }, 0);
            } else if (e.key === "Tab") {
              e.preventDefault();
              if (onStopEditing && inputRef.current) {
                onStopEditing(inputRef.current.value);
              }
              // Navigate right after stopping edit
              setTimeout(() => {
                if (onNavigateAfterEdit) {
                  onNavigateAfterEdit("right");
                }
              }, 0);
            } else if (e.key === "Escape") {
              e.preventDefault();
              if (onStopEditing && inputRef.current) {
                onStopEditing(inputRef.current.value);
              }
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full h-full px-1 text-sm flex items-center ${
            typeof cell?.computed === "number" ? "text-right" : "text-left"
          } border-none outline-none bg-transparent`}
          style={{
            fontWeight: cell?.bold ? "bold" : undefined,
            color: cell?.textColor || undefined,
          }}
        />
      ) : graphicView && graphicComponents.length > 0 ? (
        // Render inline graphic
        <InlineCellGraphic
          view={graphicView}
          components={graphicComponents}
          cells={cells}
          dimensionCells={dimensionCells}
          width={columnWidth}
          height={rowHeight}
        />
      ) : (
        <div
          className={`w-full h-full px-1 text-sm flex items-center ${
            typeof cell?.computed === "number" ? "justify-end" : "justify-start"
          } select-none overflow-hidden`}
          title={cell?.computed?.toString() || ""}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (onStartEditing) {
              onStartEditing(cellRef);
            }
          }}
        >
          <span className="truncate">
            {(() => {
              const v = cell?.computed;
              if (
                typeof v === "number" &&
                isFinite(v) &&
                cell?.decimals !== undefined
              ) {
                return v.toFixed(cell.decimals);
              }
              return v?.toString() || "";
            })()}
          </span>
        </div>
      )}
      {/* Note indicator */}
      {cell?.note && !isHidden && (
        <NoteIndicator note={cell.note} fontScale={fontScale} />
      )}
      {/* Visual indicator for adding mode */}
      {isAddingToFormula && !isHidden && (
        <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full opacity-75"></div>
      )}
    </div>
  );
};

export default React.memo(SpreadSheetCell, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.cellRef === nextProps.cellRef &&
    prevProps.cell?.value === nextProps.cell?.value &&
    prevProps.cell?.computed === nextProps.cell?.computed &&
    prevProps.cell?.bold === nextProps.cell?.bold &&
    prevProps.cell?.textColor === nextProps.cell?.textColor &&
    prevProps.cell?.backgroundColor === nextProps.cell?.backgroundColor &&
    prevProps.cell?.border === nextProps.cell?.border &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isHidden === nextProps.isHidden &&
    prevProps.isAddingToFormula === nextProps.isAddingToFormula &&
    prevProps.rangeSelectionStart === nextProps.rangeSelectionStart &&
    prevProps.columnWidth === nextProps.columnWidth &&
    prevProps.rowHeight === nextProps.rowHeight &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.editingValue === nextProps.editingValue &&
    prevProps.fontScale === nextProps.fontScale &&
    prevProps.cell?.decimals === nextProps.cell?.decimals &&
    prevProps.cell?.conditionalFormat?.min ===
      nextProps.cell?.conditionalFormat?.min &&
    prevProps.cell?.conditionalFormat?.max ===
      nextProps.cell?.conditionalFormat?.max &&
    prevProps.cell?.conditionalFormat?.color ===
      nextProps.cell?.conditionalFormat?.color &&
    prevProps.cell?.note === nextProps.cell?.note
  );
});

// Note indicator with hover tooltip
const NoteIndicator: React.FC<{ note: string; fontScale: number }> = React.memo(
  ({ note, fontScale }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
      <div
        className="absolute top-0 right-0 z-10"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Purple triangle indicator */}
        <div
          className="w-0 h-0"
          style={{
            borderLeft: `${Math.round(8 * fontScale)}px solid transparent`,
            borderTop: `${Math.round(8 * fontScale)}px solid #7c3aed`,
          }}
        />
        {/* Tooltip */}
        {showTooltip && (
          <div
            className="absolute right-0 top-full mt-1 bg-yellow-50 border border-yellow-300 shadow-lg rounded px-2 py-1 text-xs text-gray-800 whitespace-pre-wrap max-w-[200px] z-50"
            style={{ fontSize: Math.round(11 * fontScale) }}
          >
            {note}
          </div>
        )}
      </div>
    );
  },
);
