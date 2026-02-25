import React, { useRef, useState, useEffect, useCallback } from "react";
import SpreadSheetColumnHeader from "./SpreadSheetColumnHeader";
import SpreadSheetRowHeader from "./SpreadSheetRowHeader";
import SpreadSheetCell from "./SpreadSheetCell";
import { CellGrid } from "../../commons/types";
import { MergedCell } from "./spreadsheet-types";

const ROWS = 250;
const COLS = 50; // Rendered columns (supports Excel-style naming A-ZZ in formulas)
const DEFAULT_ROW_HEIGHT = 32;
const OVERSCAN_ROWS = 5; // Render extra rows above/below viewport for smooth scrolling
const OVERSCAN_COLS = 3; // Render extra columns left/right of viewport

// Helper function to convert column index (0-based) to Excel-style column name
const getColumnLabel = (col: number): string => {
  let label = "";
  let num = col + 1; // Convert to 1-based for Excel naming
  while (num > 0) {
    const remainder = (num - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    num = Math.floor((num - 1) / 26);
  }
  return label;
};

// Helper function to convert Excel-style column name to column index (0-based)
const getColumnIndex = (label: string): number => {
  let index = 0;
  for (let i = 0; i < label.length; i++) {
    index = index * 26 + (label.charCodeAt(i) - 64);
  }
  return index - 1;
};

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
  mergedCells: MergedCell[];
  onRowHeaderContextMenu: (e: React.MouseEvent, rowIndex: number) => void;
  onColumnHeaderContextMenu: (e: React.MouseEvent, columnIndex: number) => void;
  onCellContextMenu: (e: React.MouseEvent, cellRef: string) => void;
  onCellValueChange?: (cellRef: string, value: string) => void;
  editingCell: string | null;
  inlineCellValue: string;
  onStartInlineEditing?: (cellRef: string) => void;
  onStopInlineEditing?: (value: string) => void;
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
  mergedCells,
  onRowHeaderContextMenu,
  onColumnHeaderContextMenu,
  onCellContextMenu,
  onCellValueChange,
  editingCell,
  inlineCellValue,
  onStartInlineEditing,
  onStopInlineEditing,
  onNavigateAfterEdit,
}) => {
  // Virtualization state
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({
    startRow: 0,
    endRow: 30,
    startCol: 0,
    endCol: 15,
  });

  // Calculate visible range based on scroll position
  const updateVisibleRange = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    const viewportHeight = container.clientHeight;
    const viewportWidth = container.clientWidth;

    // Calculate visible rows
    let currentHeight = 32; // Column header height
    let startRow = 0;
    let endRow = ROWS - 1;

    // Find first visible row
    for (let i = 0; i < ROWS; i++) {
      if (hiddenRows.has(i)) continue;
      const rowHeight = getRowHeight(i);
      if (currentHeight + rowHeight > scrollTop) {
        startRow = Math.max(0, i - OVERSCAN_ROWS);
        break;
      }
      currentHeight += rowHeight;
    }

    // Find last visible row
    currentHeight = 32;
    for (let i = 0; i < ROWS; i++) {
      if (hiddenRows.has(i)) continue;
      currentHeight += getRowHeight(i);
      if (currentHeight > scrollTop + viewportHeight) {
        endRow = Math.min(ROWS - 1, i + OVERSCAN_ROWS);
        break;
      }
    }

    // Calculate visible columns
    let currentWidth = 48; // Row header width
    let startCol = 0;
    let endCol = COLS - 1;

    // Find first visible column
    for (let i = 0; i < COLS; i++) {
      if (hiddenColumns.has(i)) continue;
      const colWidth = getColumnWidth(i);
      if (currentWidth + colWidth > scrollLeft) {
        startCol = Math.max(0, i - OVERSCAN_COLS);
        break;
      }
      currentWidth += colWidth;
    }

    // Find last visible column
    currentWidth = 48;
    for (let i = 0; i < COLS; i++) {
      if (hiddenColumns.has(i)) continue;
      currentWidth += getColumnWidth(i);
      if (currentWidth > scrollLeft + viewportWidth) {
        endCol = Math.min(COLS - 1, i + OVERSCAN_COLS);
        break;
      }
    }

    setVisibleRange({ startRow, endRow, startCol, endCol });
  }, [getRowHeight, getColumnWidth, hiddenRows, hiddenColumns]);

  // Update visible range on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    updateVisibleRange();

    const handleScroll = () => {
      requestAnimationFrame(updateVisibleRange);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [updateVisibleRange]);

  // Update visible range when dependencies change
  useEffect(() => {
    updateVisibleRange();
  }, [updateVisibleRange, hiddenRows, hiddenColumns, freezeRow, freezeColumn]);
  // Get cell reference (e.g., A1, B2)
  const getCellRef = (row: number, col: number): string => {
    return `${getColumnLabel(col)}${row + 1}`;
  };

  // Parse cell reference to get row/col
  const parseCellRef = (ref: string): { row: number; col: number } | null => {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    const col = getColumnIndex(match[1]);
    const row = Number.parseInt(match[2]) - 1;
    return { row, col };
  };

  // Check if a cell is part of a merged region and get merge info
  const getMergeInfo = (row: number, col: number): MergedCell | null => {
    return (
      mergedCells.find((merge) => {
        const mergeStart = parseCellRef(merge.startCell);
        const mergeEnd = parseCellRef(merge.endCell);
        if (!mergeStart || !mergeEnd) return false;
        return (
          row >= mergeStart.row &&
          row <= mergeEnd.row &&
          col >= mergeStart.col &&
          col <= mergeEnd.col
        );
      }) || null
    );
  };

  // Check if a cell should be hidden because it's part of a merge but not the master cell
  const shouldHideMergedCell = (row: number, col: number): boolean => {
    const mergeInfo = getMergeInfo(row, col);
    if (!mergeInfo) return false;
    const mergeStart = parseCellRef(mergeInfo.startCell);
    if (!mergeStart) return false;
    // Hide if it's not the top-left cell of the merge
    return row !== mergeStart.row || col !== mergeStart.col;
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

  // Calculate total grid dimensions for virtualization
  const getTotalWidth = useCallback(() => {
    let total = 48; // Row header width
    for (let i = 0; i < COLS; i++) {
      if (!hiddenColumns.has(i)) {
        total += getColumnWidth(i);
      }
    }
    return total;
  }, [getColumnWidth, hiddenColumns]);

  const getTotalHeight = useCallback(() => {
    let total = 32; // Column header height
    for (let i = 0; i < ROWS; i++) {
      if (!hiddenRows.has(i)) {
        total += getRowHeight(i);
      }
    }
    return total;
  }, [getRowHeight, hiddenRows]);

  // Calculate offset for a specific row (for absolute positioning)
  const getRowOffset = useCallback(
    (row: number) => {
      let offset = 32; // Column header height
      for (let i = 0; i < row; i++) {
        if (!hiddenRows.has(i)) {
          offset += getRowHeight(i);
        }
      }
      return offset;
    },
    [getRowHeight, hiddenRows],
  );

  // Calculate offset for a specific column (for absolute positioning)
  const getColOffset = useCallback(
    (col: number) => {
      let offset = 48; // Row header width
      for (let i = 0; i < col; i++) {
        if (!hiddenColumns.has(i)) {
          offset += getColumnWidth(i);
        }
      }
      return offset;
    },
    [getColumnWidth, hiddenColumns],
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto relative border-l border-t border-gray-300"
    >
      <div
        className="relative"
        style={{
          width: getTotalWidth(),
          height: getTotalHeight(),
        }}
      >
        {/* Column Headers */}
        <div className="flex sticky top-0 bg-gray-50 border-b z-30">
          <div className="w-12 h-8 border-r border-gray-300 bg-gray-100 sticky left-0 z-40"></div>
          {Array.from(
            { length: visibleRange.endCol - visibleRange.startCol + 1 },
            (_, idx) => {
              const col = visibleRange.startCol + idx;
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
                : {
                    position: "absolute" as const,
                    left: getColOffset(col),
                  };

              return (
                <div key={col} style={headerStyle}>
                  <SpreadSheetColumnHeader
                    columnIndex={col}
                    columnLabel={getColumnLabel(col)}
                    columnWidth={getColumnWidth(col)}
                    defaultRowHeight={DEFAULT_ROW_HEIGHT}
                    onResizeStart={handleResizeStart}
                    onContextMenu={(e) => onColumnHeaderContextMenu(e, col)}
                  />
                </div>
              );
            },
          )}
        </div>

        {/* Rows - only render visible rows */}
        {Array.from(
          { length: visibleRange.endRow - visibleRange.startRow + 1 },
          (_, idx) => {
            const row = visibleRange.startRow + idx;
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
              : {
                  position: "absolute" as const,
                  top: getRowOffset(row),
                  left: 0,
                  right: 0,
                };

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

                {/* Cells - only render visible columns */}
                {Array.from(
                  { length: visibleRange.endCol - visibleRange.startCol + 1 },
                  (_, idx) => {
                    const col = visibleRange.startCol + idx;
                    // Skip hidden columns
                    if (hiddenColumns.has(col)) {
                      return null;
                    }

                    // Skip cells that are part of a merge but not the master cell
                    if (shouldHideMergedCell(row, col)) {
                      return null;
                    }

                    const cellRef = getCellRef(row, col);
                    const cell = cells[cellRef];
                    const isSelected = selectedCells.has(cellRef);
                    const isHidden = hiddenCells.has(cellRef);
                    const isColFrozen = col < freezeColumn;
                    const isFrozen = isRowFrozen || isColFrozen;

                    // Get merge info if this cell is the master of a merged region
                    const mergeInfo = getMergeInfo(row, col);
                    const isMasterCell =
                      mergeInfo &&
                      parseCellRef(mergeInfo.startCell)?.row === row &&
                      parseCellRef(mergeInfo.startCell)?.col === col;

                    // Calculate dimensions for merged cells
                    let cellWidth = getColumnWidth(col);
                    let cellHeight = getRowHeight(row);

                    if (isMasterCell && mergeInfo) {
                      // Sum up widths for all columns in the merge
                      const mergeStart = parseCellRef(mergeInfo.startCell);
                      const mergeEnd = parseCellRef(mergeInfo.endCell);
                      if (mergeStart && mergeEnd) {
                        cellWidth = 0;
                        for (let c = mergeStart.col; c <= mergeEnd.col; c++) {
                          if (!hiddenColumns.has(c)) {
                            cellWidth += getColumnWidth(c);
                          }
                        }

                        cellHeight = 0;
                        for (let r = mergeStart.row; r <= mergeEnd.row; r++) {
                          if (!hiddenRows.has(r)) {
                            cellHeight += getRowHeight(r);
                          }
                        }
                      }
                    }

                    const cellStyle = isColFrozen
                      ? {
                          position: "sticky" as const,
                          left: getFrozenColumnOffset(col),
                          zIndex: isRowFrozen ? 30 : 15,
                        }
                      : {
                          position: "absolute" as const,
                          left: getColOffset(col),
                        };

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
                          columnWidth={cellWidth}
                          rowHeight={cellHeight}
                          onCellClick={handleCellClick}
                          onCellContextMenu={onCellContextMenu}
                          onCellValueChange={onCellValueChange}
                          isEditing={editingCell === cellRef}
                          editingValue={
                            editingCell === cellRef ? inlineCellValue : ""
                          }
                          onStartEditing={onStartInlineEditing}
                          onStopEditing={onStopInlineEditing}
                          onNavigateAfterEdit={onNavigateAfterEdit}
                        />
                      </div>
                    );
                  },
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
};

export default React.memo(SpreadSheetGrid);
