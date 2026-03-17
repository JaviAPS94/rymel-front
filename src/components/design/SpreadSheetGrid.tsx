import React, { useRef, useState, useEffect, useCallback } from "react";
import SpreadSheetColumnHeader from "./SpreadSheetColumnHeader";
import SpreadSheetRowHeader from "./SpreadSheetRowHeader";
import SpreadSheetCell from "./SpreadSheetCell";
import { CellGrid } from "../../commons/types";
import { MergedCell } from "./spreadsheet-types";

const ROWS = 250;
const COLS = 50; // Rendered columns (supports Excel-style naming A-ZZ in formulas)
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
  onGridReady?: (scrollToCell: (cellRef: string) => void) => void;
  zoom?: number;
}

const SpreadSheetGrid: React.FC<SpreadSheetGridProps> = ({
  cells,
  selectedCell: _selectedCell,
  selectedCells,
  isAddingToFormula,
  rangeSelectionStart,
  getColumnWidth: getColumnWidthBase,
  getRowHeight: getRowHeightBase,
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
  onGridReady,
  zoom = 100,
}) => {
  // Zoom scale factor
  const scale = zoom / 100;
  // Scaled dimension helpers — shadow the prop names so all layout code uses scaled values automatically
  const getColumnWidth = useCallback(
    (col: number) => getColumnWidthBase(col) * scale,
    [getColumnWidthBase, scale],
  );
  const getRowHeight = useCallback(
    (row: number) => getRowHeightBase(row) * scale,
    [getRowHeightBase, scale],
  );
  // Scaled fixed header dimensions
  const SCALED_HEADER_HEIGHT = Math.round(32 * scale);
  const SCALED_ROW_HEADER_WIDTH = Math.round(48 * scale);
  // Unscaled resize handler — passes logical (unscaled) sizes to parent so resize math stays correct
  const handleResizeStartUnscaled = useCallback(
    (
      e: React.MouseEvent,
      type: "column" | "row",
      index: number,
      _scaledSize: number,
    ) => {
      const logicalSize =
        type === "column" ? getColumnWidthBase(index) : getRowHeightBase(index);
      handleResizeStart(e, type, index, logicalSize);
    },
    [getColumnWidthBase, getRowHeightBase, handleResizeStart],
  );

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
    let currentHeight = SCALED_HEADER_HEIGHT; // Column header height
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
    currentHeight = SCALED_HEADER_HEIGHT;
    for (let i = 0; i < ROWS; i++) {
      if (hiddenRows.has(i)) continue;
      currentHeight += getRowHeight(i);
      if (currentHeight > scrollTop + viewportHeight) {
        endRow = Math.min(ROWS - 1, i + OVERSCAN_ROWS);
        break;
      }
    }

    // Calculate visible columns
    let currentWidth = SCALED_ROW_HEADER_WIDTH; // Row header width
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
    currentWidth = SCALED_ROW_HEADER_WIDTH;
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

  // Scroll to a specific cell, ensuring it's visible with some padding
  const scrollToCell = useCallback(
    (cellRef: string) => {
      if (!containerRef.current) return;

      const parsed = parseCellRef(cellRef);
      if (!parsed) return;

      const { row, col } = parsed;
      const container = containerRef.current;
      const scrollPadding = 50; // Extra space around the cell

      // Calculate row position
      let rowTop = SCALED_HEADER_HEIGHT; // Column header height
      for (let i = 0; i < row; i++) {
        if (!hiddenRows.has(i)) {
          rowTop += getRowHeight(i);
        }
      }
      const rowHeight = getRowHeight(row);
      const rowBottom = rowTop + rowHeight;

      // Calculate column position
      let colLeft = SCALED_ROW_HEADER_WIDTH; // Row header width
      for (let i = 0; i < col; i++) {
        if (!hiddenColumns.has(i)) {
          colLeft += getColumnWidth(i);
        }
      }
      const colWidth = getColumnWidth(col);
      const colRight = colLeft + colWidth;

      // Get current viewport
      const viewportTop = container.scrollTop;
      const viewportBottom = viewportTop + container.clientHeight;
      const viewportLeft = container.scrollLeft;
      const viewportRight = viewportLeft + container.clientWidth;

      // Calculate new scroll position if needed
      let newScrollTop = container.scrollTop;
      let newScrollLeft = container.scrollLeft;

      // Check vertical scroll
      if (rowTop < viewportTop + scrollPadding) {
        // Cell is above viewport or too close to top
        newScrollTop = Math.max(0, rowTop - scrollPadding);
      } else if (rowBottom > viewportBottom - scrollPadding) {
        // Cell is below viewport or too close to bottom
        newScrollTop = rowBottom - container.clientHeight + scrollPadding;
      }

      // Check horizontal scroll
      if (colLeft < viewportLeft + scrollPadding) {
        // Cell is left of viewport or too close to left edge
        newScrollLeft = Math.max(0, colLeft - scrollPadding);
      } else if (colRight > viewportRight - scrollPadding) {
        // Cell is right of viewport or too close to right edge
        newScrollLeft = colRight - container.clientWidth + scrollPadding;
      }

      // Perform smooth scroll if needed
      if (
        newScrollTop !== container.scrollTop ||
        newScrollLeft !== container.scrollLeft
      ) {
        container.scrollTo({
          top: newScrollTop,
          left: newScrollLeft,
          behavior: "smooth",
        });
      }
    },
    [getRowHeight, getColumnWidth, hiddenRows, hiddenColumns],
  );

  // Expose scrollToCell function to parent component
  useEffect(() => {
    if (onGridReady) {
      onGridReady(scrollToCell);
    }
  }, [onGridReady, scrollToCell]);

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
    let offset = SCALED_ROW_HEADER_WIDTH; // Row header width
    for (let i = 0; i < col; i++) {
      if (!hiddenColumns.has(i)) {
        offset += getColumnWidth(i);
      }
    }
    return offset;
  };

  // Calculate cumulative height for frozen rows
  const getFrozenRowOffset = (row: number): number => {
    let offset = SCALED_HEADER_HEIGHT; // Column header height
    for (let i = 0; i < row; i++) {
      if (!hiddenRows.has(i)) {
        offset += getRowHeight(i);
      }
    }
    return offset;
  };

  // Calculate total grid dimensions for virtualization
  const getTotalWidth = useCallback(() => {
    let total = SCALED_ROW_HEADER_WIDTH; // Row header width
    for (let i = 0; i < COLS; i++) {
      if (!hiddenColumns.has(i)) {
        total += getColumnWidth(i);
      }
    }
    return total;
  }, [getColumnWidth, hiddenColumns, SCALED_ROW_HEADER_WIDTH]);

  const getTotalHeight = useCallback(() => {
    let total = SCALED_HEADER_HEIGHT; // Column header height
    for (let i = 0; i < ROWS; i++) {
      if (!hiddenRows.has(i)) {
        total += getRowHeight(i);
      }
    }
    return total;
  }, [getRowHeight, hiddenRows, SCALED_HEADER_HEIGHT]);

  // Calculate offset for a specific row (for absolute positioning)
  const getRowOffset = useCallback(
    (row: number) => {
      let offset = SCALED_HEADER_HEIGHT; // Column header height
      for (let i = 0; i < row; i++) {
        if (!hiddenRows.has(i)) {
          offset += getRowHeight(i);
        }
      }
      return offset;
    },
    [getRowHeight, hiddenRows, SCALED_HEADER_HEIGHT],
  );

  // Calculate offset for a specific column (for absolute positioning)
  const getColOffset = useCallback(
    (col: number) => {
      let offset = SCALED_ROW_HEADER_WIDTH; // Row header width
      for (let i = 0; i < col; i++) {
        if (!hiddenColumns.has(i)) {
          offset += getColumnWidth(i);
        }
      }
      return offset;
    },
    [getColumnWidth, hiddenColumns, SCALED_ROW_HEADER_WIDTH],
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
          <div
            className="border-r border-gray-300 bg-gray-100 sticky left-0 z-40"
            style={{
              width: SCALED_ROW_HEADER_WIDTH,
              minWidth: SCALED_ROW_HEADER_WIDTH,
              height: SCALED_HEADER_HEIGHT,
            }}
          ></div>

          {/* Frozen column headers (always visible) */}
          {freezeColumn > 0 &&
            Array.from({ length: freezeColumn }, (_, col) => {
              // Skip hidden columns
              if (hiddenColumns.has(col)) {
                return null;
              }

              const headerStyle = {
                position: "sticky" as const,
                left: getFrozenColumnOffset(col),
                zIndex: 35,
              };

              return (
                <div key={`frozen-header-${col}`} style={headerStyle}>
                  <SpreadSheetColumnHeader
                    columnIndex={col}
                    columnLabel={getColumnLabel(col)}
                    columnWidth={getColumnWidth(col)}
                    defaultRowHeight={SCALED_HEADER_HEIGHT}
                    onResizeStart={handleResizeStartUnscaled}
                    onContextMenu={(e) => onColumnHeaderContextMenu(e, col)}
                  />
                </div>
              );
            })}

          {/* Visible non-frozen column headers */}
          {Array.from(
            { length: visibleRange.endCol - visibleRange.startCol + 1 },
            (_, idx) => {
              const col = visibleRange.startCol + idx;

              // Skip frozen columns (already rendered above)
              if (col < freezeColumn) {
                return null;
              }

              // Skip hidden columns
              if (hiddenColumns.has(col)) {
                return null;
              }

              const headerStyle = {
                position: "absolute" as const,
                left: getColOffset(col),
              };

              return (
                <div key={col} style={headerStyle}>
                  <SpreadSheetColumnHeader
                    columnIndex={col}
                    columnLabel={getColumnLabel(col)}
                    columnWidth={getColumnWidth(col)}
                    defaultRowHeight={SCALED_HEADER_HEIGHT}
                    onResizeStart={handleResizeStartUnscaled}
                    onContextMenu={(e) => onColumnHeaderContextMenu(e, col)}
                  />
                </div>
              );
            },
          )}
        </div>

        {/* Rows - Frozen rows are always rendered, regular rows are virtualized */}
        {/* First: Render frozen rows (always visible) */}
        {freezeRow > 0 &&
          Array.from({ length: freezeRow }, (_, row) => {
            // Skip hidden rows
            if (hiddenRows.has(row)) {
              return null;
            }

            const rowStyle = {
              position: "sticky" as const,
              top: getFrozenRowOffset(row),
              zIndex: 25,
            };

            return (
              <div key={`frozen-${row}`} className="flex" style={rowStyle}>
                {/* Row Header */}
                <div
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 30,
                  }}
                >
                  <SpreadSheetRowHeader
                    rowIndex={row}
                    rowHeight={getRowHeight(row)}
                    width={SCALED_ROW_HEADER_WIDTH}
                    fontSize={Math.round(12 * scale)}
                    onResizeStart={handleResizeStartUnscaled}
                    onContextMenu={(e) => onRowHeaderContextMenu(e, row)}
                  />
                </div>

                {/* Cells - render frozen columns + visible columns */}
                {/* First render frozen columns */}
                {freezeColumn > 0 &&
                  Array.from({ length: freezeColumn }, (_, col) => {
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

                    const cellStyle = {
                      position: "sticky" as const,
                      left: getFrozenColumnOffset(col),
                      zIndex: 30,
                    };

                    return (
                      <div key={`frozen-col-${col}`} style={cellStyle}>
                        <SpreadSheetCell
                          cellRef={cellRef}
                          cell={cell}
                          cells={cells}
                          isSelected={isSelected}
                          isHidden={isHidden}
                          isFrozen={true}
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
                          fontScale={scale}
                        />
                      </div>
                    );
                  })}

                {/* Then render visible non-frozen columns */}
                {Array.from(
                  { length: visibleRange.endCol - visibleRange.startCol + 1 },
                  (_, idx) => {
                    const col = visibleRange.startCol + idx;

                    // Skip frozen columns (already rendered)
                    if (col < freezeColumn) {
                      return null;
                    }

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

                    const cellStyle = {
                      position: "absolute" as const,
                      left: getColOffset(col),
                    };

                    return (
                      <div key={col} style={cellStyle}>
                        <SpreadSheetCell
                          cellRef={cellRef}
                          cell={cell}
                          cells={cells}
                          isSelected={isSelected}
                          isHidden={isHidden}
                          isFrozen={true}
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
                          fontScale={scale}
                        />
                      </div>
                    );
                  },
                )}
              </div>
            );
          })}

        {/* Second: Render visible non-frozen rows */}
        {Array.from(
          { length: visibleRange.endRow - visibleRange.startRow + 1 },
          (_, idx) => {
            const row = visibleRange.startRow + idx;

            // Skip frozen rows (already rendered above)
            if (row < freezeRow) {
              return null;
            }

            // Skip hidden rows
            if (hiddenRows.has(row)) {
              return null;
            }

            const rowStyle = {
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
                    zIndex: 20,
                  }}
                >
                  <SpreadSheetRowHeader
                    rowIndex={row}
                    rowHeight={getRowHeight(row)}
                    width={SCALED_ROW_HEADER_WIDTH}
                    fontSize={Math.round(12 * scale)}
                    onResizeStart={handleResizeStartUnscaled}
                    onContextMenu={(e) => onRowHeaderContextMenu(e, row)}
                  />
                </div>

                {/* Cells - render frozen columns + visible columns */}
                {/* First render frozen columns */}
                {freezeColumn > 0 &&
                  Array.from({ length: freezeColumn }, (_, col) => {
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

                    const cellStyle = {
                      position: "sticky" as const,
                      left: getFrozenColumnOffset(col),
                      zIndex: 15,
                    };

                    return (
                      <div key={`frozen-col-${col}`} style={cellStyle}>
                        <SpreadSheetCell
                          cellRef={cellRef}
                          cell={cell}
                          cells={cells}
                          isSelected={isSelected}
                          isHidden={isHidden}
                          isFrozen={true}
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
                          fontScale={scale}
                        />
                      </div>
                    );
                  })}

                {/* Then render visible non-frozen columns */}
                {Array.from(
                  { length: visibleRange.endCol - visibleRange.startCol + 1 },
                  (_, idx) => {
                    const col = visibleRange.startCol + idx;

                    // Skip frozen columns (already rendered)
                    if (col < freezeColumn) {
                      return null;
                    }

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

                    const cellStyle = {
                      position: "absolute" as const,
                      left: getColOffset(col),
                    };

                    return (
                      <div key={col} style={cellStyle}>
                        <SpreadSheetCell
                          cellRef={cellRef}
                          cell={cell}
                          cells={cells}
                          isSelected={isSelected}
                          isHidden={isHidden}
                          isFrozen={false}
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
                          fontScale={scale}
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
