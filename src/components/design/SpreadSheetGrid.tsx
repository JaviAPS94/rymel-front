import React from "react";
import SpreadSheetColumnHeader from "./SpreadSheetColumnHeader";
import SpreadSheetRowHeader from "./SpreadSheetRowHeader";
import SpreadSheetCell from "./SpreadSheetCell";
import { CellGrid } from "../../commons/types";

const COLUMN_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROWS = 100;
const COLS = 26;
const DEFAULT_ROW_HEIGHT = 32;

interface SpreadSheetGridProps {
  cells: CellGrid;
  selectedCell: string;
  selectedCells: Set<string>;
  isAddingToFormula: boolean;
  rangeSelectionStart: string | null;
  getColumnWidth: (col: number) => number;
  getRowHeight: (row: number) => number;
  handleCellClick: (cellRef: string, event?: React.MouseEvent) => void;
  handleResizeStart: (
    e: React.MouseEvent,
    type: "column" | "row",
    index: number,
    currentSize: number,
  ) => void;
  hiddenRows: Set<number>;
  hiddenColumns: Set<number>;
  hiddenCells: Set<string>;
  freezeRow: number;
  freezeColumn: number;
  onRowHeaderContextMenu: (e: React.MouseEvent, rowIndex: number) => void;
  onColumnHeaderContextMenu: (e: React.MouseEvent, columnIndex: number) => void;
  onCellContextMenu: (e: React.MouseEvent, cellRef: string) => void;
  onCellValueChange?: (cellRef: string, value: string) => void;
  editingCell: string | null;
  inlineCellValue: string;
  onStartInlineEditing?: (cellRef: string) => void;
  onInlineValueChange?: (value: string) => void;
  onStopInlineEditing?: () => void;
  onNavigateAfterEdit?: (direction: "down" | "right") => void;
}

const SpreadSheetGrid: React.FC<SpreadSheetGridProps> = ({
  cells,
  selectedCell: _selectedCell,
  selectedCells,
  isAddingToFormula,
  rangeSelectionStart,
  getColumnWidth,
  getRowHeight,
  handleCellClick,
  handleResizeStart,
  hiddenRows,
  hiddenColumns,
  hiddenCells,
  freezeRow,
  freezeColumn,
  onRowHeaderContextMenu,
  onColumnHeaderContextMenu,
  onCellContextMenu,
  onCellValueChange,
  editingCell,
  inlineCellValue,
  onStartInlineEditing,
  onInlineValueChange,
  onStopInlineEditing,
  onNavigateAfterEdit,
}) => {
  // Get cell reference (e.g., A1, B2)
  const getCellRef = (row: number, col: number): string => {
    return `${COLUMN_LABELS[col]}${row + 1}`;
  };

  // Calculate cumulative width for frozen columns
  const getFrozenColumnOffset = (col: number): number => {
    let offset = 48; // Row header width
    for (let i = 0; i < col; i++) {
      if (!hiddenColumns.has(i)) {
        offset += getColumnWidth(i);
      }
    }
    return offset;
  };

  // Calculate cumulative height for frozen rows
  const getFrozenRowOffset = (row: number): number => {
    let offset = 32; // Column header height
    for (let i = 0; i < row; i++) {
      if (!hiddenRows.has(i)) {
        offset += getRowHeight(i);
      }
    }
    return offset;
  };

  return (
    <div className="flex-1 overflow-auto relative">
      <div className="inline-block min-w-full">
        {/* Column Headers */}
        <div className="flex sticky top-0 bg-gray-50 border-b z-30">
          <div className="w-12 h-8 border-r border-gray-300 bg-gray-100 sticky left-0 z-40"></div>
          {Array.from({ length: COLS }, (_, col) => {
            // Skip hidden columns
            if (hiddenColumns.has(col)) {
              return null;
            }

            const isFrozen = col < freezeColumn;
            const headerStyle = isFrozen
              ? {
                  position: "sticky" as const,
                  left: getFrozenColumnOffset(col),
                  zIndex: 35,
                }
              : {};

            return (
              <div key={col} style={headerStyle}>
                <SpreadSheetColumnHeader
                  columnIndex={col}
                  columnLabel={COLUMN_LABELS[col]}
                  columnWidth={getColumnWidth(col)}
                  defaultRowHeight={DEFAULT_ROW_HEIGHT}
                  onResizeStart={handleResizeStart}
                  onContextMenu={(e) => onColumnHeaderContextMenu(e, col)}
                />
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {Array.from({ length: ROWS }, (_, row) => {
          // Skip hidden rows
          if (hiddenRows.has(row)) {
            return null;
          }

          const isRowFrozen = row < freezeRow;
          const rowStyle = isRowFrozen
            ? {
                position: "sticky" as const,
                top: getFrozenRowOffset(row),
                zIndex: 25,
              }
            : {};

          return (
            <div key={row} className="flex" style={rowStyle}>
              {/* Row Header */}
              <div
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: isRowFrozen ? 30 : 20,
                }}
              >
                <SpreadSheetRowHeader
                  rowIndex={row}
                  rowHeight={getRowHeight(row)}
                  onResizeStart={handleResizeStart}
                  onContextMenu={(e) => onRowHeaderContextMenu(e, row)}
                />
              </div>

              {/* Cells */}
              {Array.from({ length: COLS }, (_, col) => {
                // Skip hidden columns
                if (hiddenColumns.has(col)) {
                  return null;
                }

                const cellRef = getCellRef(row, col);
                const cell = cells[cellRef];
                const isSelected = selectedCells.has(cellRef);
                const isHidden = hiddenCells.has(cellRef);
                const isColFrozen = col < freezeColumn;
                const isFrozen = isRowFrozen || isColFrozen;

                const cellStyle = isColFrozen
                  ? {
                      position: "sticky" as const,
                      left: getFrozenColumnOffset(col),
                      zIndex: isRowFrozen ? 30 : 15,
                    }
                  : {};

                return (
                  <div key={col} style={cellStyle}>
                    <SpreadSheetCell
                      cellRef={cellRef}
                      cell={cell}
                      isSelected={isSelected}
                      isHidden={isHidden}
                      isFrozen={isFrozen}
                      isAddingToFormula={isAddingToFormula}
                      rangeSelectionStart={rangeSelectionStart}
                      columnWidth={getColumnWidth(col)}
                      rowHeight={getRowHeight(row)}
                      onCellClick={handleCellClick}
                      onCellContextMenu={onCellContextMenu}
                      onCellValueChange={onCellValueChange}
                      isEditing={editingCell === cellRef}
                      editingValue={
                        editingCell === cellRef ? inlineCellValue : ""
                      }
                      onStartEditing={onStartInlineEditing}
                      onEditingValueChange={onInlineValueChange}
                      onStopEditing={onStopInlineEditing}
                      onNavigateAfterEdit={onNavigateAfterEdit}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SpreadSheetGrid;
