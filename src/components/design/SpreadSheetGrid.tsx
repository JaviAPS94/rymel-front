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
  onRowHeaderContextMenu: (e: React.MouseEvent, rowIndex: number) => void;
  onColumnHeaderContextMenu: (e: React.MouseEvent, columnIndex: number) => void;
}

const SpreadSheetGrid: React.FC<SpreadSheetGridProps> = ({
  cells,
  selectedCell,
  isAddingToFormula,
  rangeSelectionStart,
  getColumnWidth,
  getRowHeight,
  handleCellClick,
  handleResizeStart,
  hiddenRows,
  hiddenColumns,
  onRowHeaderContextMenu,
  onColumnHeaderContextMenu,
}) => {
  // Get cell reference (e.g., A1, B2)
  const getCellRef = (row: number, col: number): string => {
    return `${COLUMN_LABELS[col]}${row + 1}`;
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="inline-block min-w-full">
        {/* Column Headers */}
        <div className="flex sticky top-0 bg-gray-50 border-b">
          <div className="w-12 h-8 border-r border-gray-300 bg-gray-100"></div>
          {Array.from({ length: COLS }, (_, col) => {
            // Skip hidden columns
            if (hiddenColumns.has(col)) {
              return null;
            }

            return (
              <SpreadSheetColumnHeader
                key={col}
                columnIndex={col}
                columnLabel={COLUMN_LABELS[col]}
                columnWidth={getColumnWidth(col)}
                defaultRowHeight={DEFAULT_ROW_HEIGHT}
                onResizeStart={handleResizeStart}
                onContextMenu={(e) => onColumnHeaderContextMenu(e, col)}
              />
            );
          })}
        </div>

        {/* Rows */}
        {Array.from({ length: ROWS }, (_, row) => {
          // Skip hidden rows
          if (hiddenRows.has(row)) {
            return null;
          }

          return (
            <div key={row} className="flex border-b border-gray-200">
              {/* Row Header */}
              <SpreadSheetRowHeader
                rowIndex={row}
                rowHeight={getRowHeight(row)}
                onResizeStart={handleResizeStart}
                onContextMenu={(e) => onRowHeaderContextMenu(e, row)}
              />

              {/* Cells */}
              {Array.from({ length: COLS }, (_, col) => {
                // Skip hidden columns
                if (hiddenColumns.has(col)) {
                  return null;
                }

                const cellRef = getCellRef(row, col);
                const cell = cells[cellRef];
                const isSelected = selectedCell === cellRef;

                return (
                  <SpreadSheetCell
                    key={col}
                    cellRef={cellRef}
                    cell={cell}
                    isSelected={isSelected}
                    isAddingToFormula={isAddingToFormula}
                    rangeSelectionStart={rangeSelectionStart}
                    columnWidth={getColumnWidth(col)}
                    rowHeight={getRowHeight(row)}
                    onCellClick={handleCellClick}
                  />
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
