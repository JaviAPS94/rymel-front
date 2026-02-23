import React from "react";
import { Cell } from "./spreadsheet-types";

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
}) => {
  // Check if this cell has dropdown options
  const hasOptions = cell?.options && cell.options.length > 0;
  // Compute style from cell properties
  const cellStyle: React.CSSProperties = {
    width: columnWidth,
    height: rowHeight,
    minWidth: columnWidth,
    minHeight: rowHeight,
    fontWeight: cell?.bold ? "bold" : undefined,
    color: cell?.textColor || undefined,
    background: cell?.backgroundColor || (isFrozen ? "#ffffff" : undefined),
    boxSizing: "border-box",
    // Use negative margins to make borders collapse properly
    marginRight: "-1px",
    marginBottom: "-1px",
  };

  // Handle border styling separately to avoid overlap
  if (cell?.border) {
    // Custom border applies to all sides
    cellStyle.border = cell.border;
  } else {
    // Default Excel-like grid lines (only right and bottom to avoid doubling)
    cellStyle.borderRight = "1px solid #e5e7eb";
    cellStyle.borderBottom = "1px solid #e5e7eb";
  }

  return (
    <div
      className={`relative cursor-pointer ${
        isSelected
          ? "ring-2 ring-blue-500 bg-blue-50"
          : isAddingToFormula
            ? "hover:bg-green-100 hover:ring-2 hover:ring-green-400"
            : rangeSelectionStart === cellRef
              ? "bg-orange-200 ring-2 ring-orange-500"
              : "hover:bg-gray-50"
      } ${isSelected ? "outline outline-2 outline-blue-400" : ""}`}
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
      ) : (
        <div
          className={`w-full h-full px-1 text-sm flex items-center ${
            typeof cell?.computed === "number" ? "justify-end" : "justify-start"
          } select-none overflow-hidden`}
          title={cell?.computed?.toString() || ""}
        >
          <span className="truncate">{cell?.computed?.toString() || ""}</span>
        </div>
      )}
      {/* Visual indicator for adding mode */}
      {isAddingToFormula && !isHidden && (
        <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full opacity-75"></div>
      )}
    </div>
  );
};

export default SpreadSheetCell;
