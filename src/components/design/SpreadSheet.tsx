import React from "react";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  startTransition,
} from "react";
import {
  CellGrid,
  DesignSubtype,
  ElementResponse,
  Template,
} from "../../commons/types";
import { useEvaluateFunctionMutation } from "../../store";

// Import new components
import FormulaBar from "./FormulaBar";
import SpreadSheetGrid from "./SpreadSheetGrid";
import SheetTabs from "./SheetTabs";
import CrossTabSelector from "./CrossTabSelector";
import FunctionLibraryModal from "./FunctionLibraryModal";
import TemplateLibraryModal from "./TemplateLibraryModal";
import { CustomFunction, Sheet } from "./spreadsheet-types";

const ROWS = 250;
const COLS = 50; // Rendered columns (supports Excel-style naming A-ZZ in formulas)
const DEFAULT_COLUMN_WIDTH = 96;
const DEFAULT_ROW_HEIGHT = 32;
const MIN_COLUMN_WIDTH = 60;
const MIN_ROW_HEIGHT = 24;

// Helper function to convert column index (0-based) to Excel-style column name
const getColumnLabel = (col: number): string => {
  let label = "";
  let num = col + 1; // Convert to 1-based
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

interface SpreadSheetProps {
  subTypeWithFunctions: DesignSubtype;
  templates: Template[];
  element: ElementResponse;
  designSubtypeId: number | null;
  setShowModalAfterSaveDesign: (show: boolean) => void;
  sheetsInitialData?: Sheet[];
  designId?: number;
  resetToInitialState?: () => void;
  setCreatedDesignId?: (id: number) => void;
  instanceId?: string; // Unique ID to distinguish between multiple SpreadSheet instances
  allSheets?: { instanceId: string; sheets: Sheet[] }[]; // All sheets from all instances for cross-instance refs
  onSheetsChange?: (instanceId: string, sheets: Sheet[]) => void; // Callback when sheets change
  showTemplateLibrary: boolean;
  setShowTemplateLibrary: (show: boolean) => void;
  sheets: Sheet[];
  setSheets: React.Dispatch<React.SetStateAction<Sheet[]>>;
}

const SpreadSheet = ({
  subTypeWithFunctions,
  templates,
  element,
  sheetsInitialData = [],
  instanceId = "default",
  allSheets = [],
  onSheetsChange,
  showTemplateLibrary,
  setShowTemplateLibrary,
  sheets = [],
  setSheets,
}: SpreadSheetProps) => {
  // Cell style toolbar state
  const [cellTextColor, setCellTextColor] = useState<string>("");
  const [cellBackgroundColor, setCellBackgroundColor] = useState<string>("");
  const [cellBorder, setCellBorder] = useState<string>("");
  const [cellBold, setCellBold] = useState<boolean>(false);
  const [cellDecimals, setCellDecimals] = useState<number | undefined>(
    undefined,
  );
  const [condFmtMin, setCondFmtMin] = useState<string>("");
  const [condFmtMax, setCondFmtMax] = useState<string>("");
  const [condFmtColor, setCondFmtColor] = useState<string>("#ff0000");

  const [activeSheetId, setActiveSheetId] = useState<string>(
    sheetsInitialData && sheetsInitialData.length > 0
      ? sheetsInitialData[0].id
      : `${instanceId}-sheet1`,
  );
  const [selectedCell, setSelectedCell] = useState<string>("A1");
  // Multi-cell selection: store as Set for fast lookup
  const [selectedCells, setSelectedCells] = useState<Set<string>>(
    new Set(["A1"]),
  );
  // Ref to track the selection anchor for shift+click range selection
  const selectionAnchorRef = useRef<string>("A1");
  // Ref to store the grid's scrollToCell function
  const scrollToCellRef = useRef<((cellRef: string) => void) | null>(null);
  // Zoom level (50-200%)
  const [zoom, setZoom] = useState<number>(100);
  // Track inline editing state
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [inlineCellValue, setInlineCellValue] = useState<string>("");
  // Copy/paste state
  const [copiedCells, setCopiedCells] = useState<
    Map<
      string,
      {
        value: string;
        formula: string;
        computed: string | number | undefined;
        bold?: boolean;
        textColor?: string;
        backgroundColor?: string;
        border?: string;
      }
    >
  >(new Map());
  const [copiedRange, setCopiedRange] = useState<{
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  } | null>(null);

  // Undo/Redo stacks
  const [undoStack, setUndoStack] = useState<Sheet[][]>([]);
  const [redoStack, setRedoStack] = useState<Sheet[][]>([]);
  const maxHistorySize = 50; // Limit history to prevent memory issues

  // Performance optimization: debounce history saving
  const saveToHistoryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingHistorySaveRef = useRef<boolean>(false);

  // Helper: select a single cell (clears others)
  const selectSingleCell = (cellRef: string) => {
    setSelectedCell(cellRef);
    selectionAnchorRef.current = cellRef; // Set as new anchor
    setSelectedCells(new Set([cellRef]));
  };

  // Helper: select a range of cells (for shift+click)
  const selectCellRange = (from: string, to: string) => {
    // Only works for same sheet, assumes A1-like refs
    const getCoords = (ref: string) => {
      const match = ref.match(/^([A-Z]+)(\d+)$/);
      if (!match) return null;
      return { col: getColumnIndex(match[1]), row: parseInt(match[2], 10) };
    };
    const start = getCoords(from);
    const end = getCoords(to);
    if (!start || !end) return;
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const cells = new Set<string>();
    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        cells.add(getColumnLabel(c) + r);
      }
    }
    setSelectedCells(cells);
  };

  // Handler: store scrollToCell function from grid
  const handleGridReady = useCallback(
    (scrollToCell: (cellRef: string) => void) => {
      scrollToCellRef.current = scrollToCell;
    },
    [],
  );

  // Helper functions to serialize/deserialize sheets for history
  const serializeSheetsForHistory = useCallback((sheets: Sheet[]) => {
    return sheets.map((sheet) => ({
      ...sheet,
      templateHiddenRows: Array.from(sheet.templateHiddenRows || []),
      templateHiddenColumns: Array.from(sheet.templateHiddenColumns || []),
      userHiddenRows: Array.from(sheet.userHiddenRows || []),
      userHiddenColumns: Array.from(sheet.userHiddenColumns || []),
      hiddenCells: Array.from(sheet.hiddenCells || []),
    }));
  }, []);

  const deserializeSheetsFromHistory = useCallback((serialized: any[]) => {
    return serialized.map((sheet) => ({
      ...sheet,
      templateHiddenRows: new Set(sheet.templateHiddenRows || []),
      templateHiddenColumns: new Set(sheet.templateHiddenColumns || []),
      userHiddenRows: new Set(sheet.userHiddenRows || []),
      userHiddenColumns: new Set(sheet.userHiddenColumns || []),
      hiddenCells: new Set(sheet.hiddenCells || []),
    }));
  }, []);

  // Save current state to undo stack
  const saveToHistory = useCallback(() => {
    setUndoStack((prev) => {
      const serialized = serializeSheetsForHistory(sheets);
      const newStack = [...prev, JSON.parse(JSON.stringify(serialized))];
      // Limit stack size
      if (newStack.length > maxHistorySize) {
        return newStack.slice(1);
      }
      return newStack;
    });
    // Clear redo stack when a new action is performed
    setRedoStack([]);
    pendingHistorySaveRef.current = false;
  }, [sheets, maxHistorySize, serializeSheetsForHistory]);

  // Debounced version for typing - saves after 1 second of inactivity
  const saveToHistoryDebounced = useCallback(() => {
    if (saveToHistoryTimeoutRef.current) {
      clearTimeout(saveToHistoryTimeoutRef.current);
    }

    if (!pendingHistorySaveRef.current) {
      // First change - save immediately to history
      saveToHistory();
      pendingHistorySaveRef.current = true;
    }

    // Schedule a save after typing stops
    saveToHistoryTimeoutRef.current = setTimeout(() => {
      pendingHistorySaveRef.current = false;
    }, 1000);
  }, [saveToHistory]);

  // Immediate save for non-typing actions (paste, style changes, etc.)
  const saveToHistoryImmediate = useCallback(() => {
    if (saveToHistoryTimeoutRef.current) {
      clearTimeout(saveToHistoryTimeoutRef.current);
    }
    saveToHistory();
  }, [saveToHistory]);

  // Undo last action
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    const previousStateSerialized = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    // Save current state to redo stack
    const currentSerialized = serializeSheetsForHistory(sheets);
    setRedoStack((prev) => [
      ...prev,
      JSON.parse(JSON.stringify(currentSerialized)),
    ]);
    setUndoStack(newUndoStack);

    // Restore previous state
    const previousState = deserializeSheetsFromHistory(previousStateSerialized);
    setSheets(previousState);
  }, [
    undoStack,
    sheets,
    setSheets,
    serializeSheetsForHistory,
    deserializeSheetsFromHistory,
  ]);

  // Redo last undone action
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextStateSerialized = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    // Save current state to undo stack
    const currentSerialized = serializeSheetsForHistory(sheets);
    setUndoStack((prev) => [
      ...prev,
      JSON.parse(JSON.stringify(currentSerialized)),
    ]);
    setRedoStack(newRedoStack);

    // Restore next state
    const nextState = deserializeSheetsFromHistory(nextStateSerialized);
    setSheets(nextState);
  }, [
    redoStack,
    sheets,
    setSheets,
    serializeSheetsForHistory,
    deserializeSheetsFromHistory,
  ]);

  // Handler to update cell style
  const updateCellStyle = useCallback(
    (
      style: Partial<{
        bold: boolean;
        textColor: string;
        backgroundColor: string;
        border: string;
      }>,
    ) => {
      // Save current state to history before making changes (immediate for style changes)
      saveToHistoryImmediate();

      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          const updatedCells = { ...sheet.cells };
          selectedCells.forEach((cellRef) => {
            updatedCells[cellRef] = {
              ...updatedCells[cellRef],
              ...style,
            };
          });
          return {
            ...sheet,
            cells: updatedCells,
          };
        }),
      );
    },
    [activeSheetId, selectedCells, setSheets, saveToHistoryImmediate],
  );

  const updateCellDecimals = useCallback(
    (delta: number) => {
      saveToHistoryImmediate();
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          const updatedCells = { ...sheet.cells };
          selectedCells.forEach((cellRef) => {
            const cell = updatedCells[cellRef];
            const current = (() => {
              if (cell?.decimals !== undefined) return cell.decimals;
              // Infer decimals from the actual computed value
              const v = cell?.computed;
              if (typeof v === "number" && isFinite(v)) {
                const str = v.toString();
                const dot = str.indexOf(".");
                return dot === -1 ? 0 : str.length - dot - 1;
              }
              return 0;
            })();
            const next = Math.max(0, Math.min(10, current + delta));
            updatedCells[cellRef] = {
              ...updatedCells[cellRef],
              decimals: next,
            };
          });
          return { ...sheet, cells: updatedCells };
        }),
      );
    },
    [activeSheetId, selectedCells, setSheets, saveToHistoryImmediate],
  );

  const applyConditionalFormat = useCallback(
    (min: string, max: string, color: string) => {
      const minVal = min.trim() !== "" ? Number(min) : undefined;
      const maxVal = max.trim() !== "" ? Number(max) : undefined;
      if (minVal !== undefined && isNaN(minVal)) return;
      if (maxVal !== undefined && isNaN(maxVal)) return;
      saveToHistoryImmediate();
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          const updatedCells = { ...sheet.cells };
          selectedCells.forEach((cellRef) => {
            const existing = updatedCells[cellRef];
            updatedCells[cellRef] = {
              ...(existing ?? { value: "", formula: "", computed: "" }),
              conditionalFormat: { min: minVal, max: maxVal, color },
            };
          });
          return { ...sheet, cells: updatedCells };
        }),
      );
    },
    [activeSheetId, selectedCells, setSheets, saveToHistoryImmediate],
  );

  const clearConditionalFormat = useCallback(() => {
    saveToHistoryImmediate();
    setSheets((prevSheets) =>
      prevSheets.map((sheet) => {
        if (sheet.id !== activeSheetId) return sheet;
        const updatedCells = { ...sheet.cells };
        selectedCells.forEach((cellRef) => {
          const { conditionalFormat: _removed, ...rest } =
            updatedCells[cellRef] || {};
          updatedCells[cellRef] = rest as (typeof updatedCells)[typeof cellRef];
        });
        return { ...sheet, cells: updatedCells };
      }),
    );
  }, [activeSheetId, selectedCells, setSheets, saveToHistoryImmediate]);

  // Expose toolbar render function for FormulaBar
  (window as any).onCellStyleToolbarRender = () => (
    <div className="flex items-center gap-3 mt-1 px-2 py-1 bg-gray-50 rounded border border-gray-200">
      <button
        className={`px-1.5 py-0.5 border rounded text-sm ${cellBold ? "font-bold bg-gray-200" : ""}`}
        title="Negrita"
        onClick={() => updateCellStyle({ bold: !cellBold })}
        type="button"
      >
        B
      </button>

      {/* Decrease / Increase decimal places */}
      <div className="flex items-center gap-1">
        <button
          className="px-1.5 py-0.5 border rounded text-xs leading-none hover:bg-gray-100"
          title="Disminuir decimales"
          onClick={() => updateCellDecimals(-1)}
          type="button"
        >
          <span className="flex items-center gap-px font-mono">
            <span>←</span>
            <span>.00</span>
          </span>
        </button>
        <button
          className="px-1.5 py-0.5 border rounded text-xs leading-none hover:bg-gray-100"
          title="Aumentar decimales"
          onClick={() => updateCellDecimals(1)}
          type="button"
        >
          <span className="flex items-center gap-px font-mono">
            <span>.00</span>
            <span>→</span>
          </span>
        </button>
        {cellDecimals !== undefined && (
          <span className="text-xs text-gray-400">{cellDecimals}d</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">Texto:</span>
        <input
          type="color"
          value={cellTextColor || "#000000"}
          title="Color de texto"
          onChange={(e) => updateCellStyle({ textColor: e.target.value })}
          className="w-6 h-6 p-0 border rounded cursor-pointer"
        />
        <span
          className="text-xs font-bold"
          style={{ color: cellTextColor || "#000000" }}
        >
          A
        </span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">Fondo:</span>
        <input
          type="color"
          value={cellBackgroundColor || "#ffffff"}
          title="Color de fondo"
          onChange={(e) => updateCellStyle({ backgroundColor: e.target.value })}
          className="w-6 h-6 p-0 border rounded cursor-pointer"
        />
        <div
          className="w-4 h-4 border border-gray-400 rounded"
          style={{ backgroundColor: cellBackgroundColor || "#ffffff" }}
        />
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">Borde:</span>
        <select
          value={cellBorder || ""}
          title="Borde"
          onChange={(e) => updateCellStyle({ border: e.target.value })}
          className="px-1.5 py-0.5 border rounded text-xs cursor-pointer"
        >
          <option value="">Sin borde</option>
          <option value="1px solid #000">Negro</option>
          <option value="1px solid #888">Gris</option>
          <option value="2px solid #007bff">Azul</option>
          <option value="2px solid #e11d48">Rojo</option>
        </select>
      </div>

      {/* Conditional formatting: highlight when value is outside [min, max] */}
      <div className="flex items-center gap-1 border-l pl-3">
        <span className="text-xs text-gray-500 whitespace-nowrap">Rango:</span>
        <input
          type="number"
          placeholder="mín"
          value={condFmtMin}
          onChange={(e) => setCondFmtMin(e.target.value)}
          className="w-14 px-1 py-0.5 border rounded text-xs"
          title="Valor mínimo del rango"
        />
        <span className="text-xs text-gray-400">–</span>
        <input
          type="number"
          placeholder="máx"
          value={condFmtMax}
          onChange={(e) => setCondFmtMax(e.target.value)}
          className="w-14 px-1 py-0.5 border rounded text-xs"
          title="Valor máximo del rango"
        />
        <input
          type="color"
          value={condFmtColor}
          onChange={(e) => setCondFmtColor(e.target.value)}
          className="w-6 h-6 p-0 border rounded cursor-pointer"
          title="Color de alerta"
        />
        <button
          type="button"
          onClick={() =>
            applyConditionalFormat(condFmtMin, condFmtMax, condFmtColor)
          }
          className="px-1.5 py-0.5 border rounded text-xs hover:bg-blue-50 hover:border-blue-400"
          title="Aplicar formato condicional"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={clearConditionalFormat}
          className="px-1.5 py-0.5 border rounded text-xs hover:bg-red-50 hover:border-red-400 text-gray-500"
          title="Quitar formato condicional"
        >
          ✕
        </button>
      </div>
    </div>
  );

  const [formulaInput, setFormulaInput] = useState<string>("");
  const formulaInputValueRef = useRef<string>(""); // Track immediate value without causing re-renders
  const [isFormulaBuildingMode, setIsFormulaBuildingMode] =
    useState<boolean>(false);
  const [isAddingToFormula, setIsAddingToFormula] = useState<boolean>(false);
  const [formulaCursorPosition, setFormulaCursorPosition] = useState<number>(0);
  const [rangeSelectionStart, setRangeSelectionStart] = useState<string | null>(
    null,
  );
  // Cross-tab reference selection state
  const [targetInstanceId, setTargetInstanceId] = useState<string>(instanceId);
  const [targetSheetId, setTargetSheetId] = useState<string>(activeSheetId);
  const [isFormulaInputFocused, setIsFormulaInputFocused] =
    useState<boolean>(false);
  const [editingSheetName, setEditingSheetName] = useState<string | null>(null);
  // Resize state
  const [isResizing, setIsResizing] = useState<{
    type: "column" | "row" | null;
    index: number;
    startPos: number;
    startSize: number;
  }>({ type: null, index: -1, startPos: 0, startSize: 0 });

  // Context menu state for hiding rows/columns
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: "row" | "column" | "cell" | null;
    index: number;
    cellRef?: string;
  }>({ visible: false, x: 0, y: 0, type: null, index: -1 });

  // Pagination and search state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTermTemplate, setSearchTermTemplate] = useState<string>("");
  const [currentPageTemplate, setCurrentPageTemplate] = useState<number>(1);
  const [functionsPerPage] = useState<number>(5); // Show 6 functions per page

  const [showFunctionLibrary, setShowFunctionLibrary] =
    useState<boolean>(false);
  const [evaluateFunction] = useEvaluateFunctionMutation();

  // Note editing state
  const [noteModal, setNoteModal] = useState<{
    visible: boolean;
    cellRef: string;
    value: string;
  }>({ visible: false, cellRef: "", value: "" });

  // Template state

  // Track if initial template has been loaded
  const [initialTemplateLoaded, setInitialTemplateLoaded] =
    useState<boolean>(false);

  // Track if sheetsInitialData has been loaded
  const [initialSheetsLoaded, setInitialSheetsLoaded] =
    useState<boolean>(false);

  // Notify parent when sheets change
  useEffect(() => {
    if (onSheetsChange) {
      onSheetsChange(instanceId, sheets);
    }
  }, [sheets, instanceId, onSheetsChange]);

  // Sync targetSheetId with activeSheetId when not actively adding cells
  useEffect(() => {
    if (!isAddingToFormula) {
      setTargetSheetId(activeSheetId);
    }
  }, [activeSheetId, isAddingToFormula]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (saveToHistoryTimeoutRef.current) {
        clearTimeout(saveToHistoryTimeoutRef.current);
      }
    };
  }, []);

  const formulaInputRef = useRef<HTMLInputElement>(null);

  // Get current sheet
  const currentSheet = sheets.find((sheet) => sheet.id === activeSheetId);
  const cells = useMemo(() => currentSheet?.cells || {}, [currentSheet?.cells]);
  const columnWidths = currentSheet?.columnWidths || {};
  const rowHeights = currentSheet?.rowHeights || {};

  // Calculate statistics for selected cells
  const selectionStats = useMemo(() => {
    if (selectedCells.size <= 1) {
      return undefined;
    }

    const values: number[] = [];
    selectedCells.forEach((cellRef) => {
      const cell = cells[cellRef];
      if (cell) {
        const value = cell.computed ?? cell.value;
        if (typeof value === "number" && !isNaN(value)) {
          values.push(value);
        } else if (typeof value === "string") {
          const numValue = parseFloat(value.replace(",", "."));
          if (!isNaN(numValue)) {
            values.push(numValue);
          }
        }
      }
    });

    const count = values.length;
    const sum = count > 0 ? values.reduce((acc, val) => acc + val, 0) : 0;
    const average = count > 0 ? sum / count : null;

    return {
      average,
      count,
      sum,
    };
  }, [selectedCells, cells]);
  // Combine template-hidden and user-hidden rows/columns
  const hiddenRows = useMemo(() => {
    const combined = new Set<number>();
    currentSheet?.templateHiddenRows?.forEach((row) => combined.add(row));
    currentSheet?.userHiddenRows?.forEach((row) => combined.add(row));
    return combined;
  }, [currentSheet?.templateHiddenRows, currentSheet?.userHiddenRows]);
  const hiddenColumns = useMemo(() => {
    const combined = new Set<number>();
    currentSheet?.templateHiddenColumns?.forEach((col) => combined.add(col));
    currentSheet?.userHiddenColumns?.forEach((col) => combined.add(col));
    return combined;
  }, [currentSheet?.templateHiddenColumns, currentSheet?.userHiddenColumns]);

  // Update toolbar state when selected cell changes (batch updates to avoid multiple re-renders)
  useEffect(() => {
    const cell = cells[selectedCell];
    // Batch state updates by checking if values actually changed
    const newTextColor = cell?.textColor || "";
    const newBackgroundColor = cell?.backgroundColor || "";
    const newBorder = cell?.border || "";
    const newBold = !!cell?.bold;

    const newDecimals = cell?.decimals;

    // Only update if values changed to minimize re-renders
    if (cellTextColor !== newTextColor) setCellTextColor(newTextColor);
    if (cellBackgroundColor !== newBackgroundColor)
      setCellBackgroundColor(newBackgroundColor);
    if (cellBorder !== newBorder) setCellBorder(newBorder);
    if (cellBold !== newBold) setCellBold(newBold);
    if (cellDecimals !== newDecimals) setCellDecimals(newDecimals);

    const cf = cell?.conditionalFormat;
    const newCondMin = cf?.min !== undefined ? String(cf.min) : "";
    const newCondMax = cf?.max !== undefined ? String(cf.max) : "";
    const newCondColor = cf?.color || "#ff0000";
    setCondFmtMin(newCondMin);
    setCondFmtMax(newCondMax);
    setCondFmtColor(newCondColor);
  }, [
    selectedCell,
    cells,
    cellTextColor,
    cellBackgroundColor,
    cellBorder,
    cellBold,
    cellDecimals,
  ]);

  // Auto-scroll when selected cell changes
  useEffect(() => {
    if (scrollToCellRef.current && selectedCell) {
      scrollToCellRef.current(selectedCell);
    }
  }, [selectedCell]);

  // Get column width
  const getColumnWidth = (col: number): number => {
    return columnWidths[col] || DEFAULT_COLUMN_WIDTH;
  };

  // Get row height
  const getRowHeight = (row: number): number => {
    return rowHeights[row] || DEFAULT_ROW_HEIGHT;
  };

  // Get cell reference (e.g., A1, B2)
  const getCellRef = (row: number, col: number): string => {
    return `${getColumnLabel(col)}${row + 1}`;
  };

  // Parse cell reference to row/col
  const parseCellRef = (ref: string): { row: number; col: number } | null => {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    const col = getColumnIndex(match[1]);
    const row = Number.parseInt(match[2]) - 1;
    return { row, col };
  };

  // Parse cross-sheet cell reference (e.g., "Sheet1!A1", "design:Sheet1!A1", or "A1")
  const parseCrossSheetRef = (
    ref: string,
    currentSheets: typeof sheets,
    currentActiveSheetId: string,
    currentInstanceId: string,
    currentAllSheets: typeof allSheets,
  ): { instanceId: string; sheetId: string; cellRef: string } | null => {
    // Check for cross-instance reference: "design:Sheet1!A1" or "cost:Sheet1!A1"
    const crossInstanceMatch = ref.match(/^([^:]+):(.+?)!([A-Z]+\d+)$/);

    if (crossInstanceMatch) {
      const targetInstanceId = crossInstanceMatch[1];
      const sheetName = crossInstanceMatch[2];
      const cellRef = crossInstanceMatch[3];

      // Find the target instance's sheets
      const targetInstance = currentAllSheets.find(
        (inst) => inst.instanceId === targetInstanceId,
      );
      if (!targetInstance) {
        return null;
      }

      // Match by sheet name OR sheet ID
      const sheet = targetInstance.sheets.find(
        (s) => s.name === sheetName || s.id === sheetName,
      );
      if (!sheet) {
        return null;
      }

      return { instanceId: targetInstanceId, sheetId: sheet.id, cellRef };
    }

    // Check for same-instance cross-sheet reference: "Sheet1!A1"
    const crossSheetMatch = ref.match(/^(.+?)!([A-Z]+\d+)$/);
    if (crossSheetMatch) {
      const sheetName = crossSheetMatch[1];
      const cellRef = crossSheetMatch[2];
      // Match by sheet name OR sheet ID
      const sheet = currentSheets.find(
        (s) => s.name === sheetName || s.id === sheetName,
      );
      if (!sheet) return null;
      return { instanceId: currentInstanceId, sheetId: sheet.id, cellRef };
    }

    // Local reference: use current sheet
    if (/^[A-Z]+\d+$/.test(ref)) {
      return {
        instanceId: currentInstanceId,
        sheetId: currentActiveSheetId,
        cellRef: ref,
      };
    }

    return null;
  };

  // Get cell value from any sheet (supports cross-sheet and cross-instance references)
  const getCellValueFromAnySheet = useCallback(
    (ref: string, currentSheets: typeof sheets): number | string => {
      const parsed = parseCrossSheetRef(
        ref,
        currentSheets,
        activeSheetId,
        instanceId,
        allSheets,
      );
      if (!parsed) {
        return 0;
      }

      // Find the correct instance's sheets
      let targetSheets = currentSheets;
      if (parsed.instanceId !== instanceId) {
        const targetInstance = allSheets.find(
          (inst) => inst.instanceId === parsed.instanceId,
        );
        if (!targetInstance) {
          return 0;
        }
        targetSheets = targetInstance.sheets;
      }

      const sheet = targetSheets.find((s) => s.id === parsed.sheetId);
      if (!sheet) {
        return 0;
      }

      const cell = sheet.cells[parsed.cellRef];
      if (cell && typeof cell.computed === "number") {
        return cell.computed;
      }
      return 0;
    },
    [activeSheetId, allSheets, instanceId],
  );

  // Select a cell (used for navigation)
  const selectCell = useCallback(
    (cellRef: string) => {
      // First, update the most critical state immediately for responsiveness
      setSelectedCell(cellRef);
      selectionAnchorRef.current = cellRef;
      setSelectedCells(new Set([cellRef])); // Update multi-selection state

      // Then batch the rest of the updates as lower priority
      startTransition(() => {
        const cell = cells[cellRef];
        const cellFormula = cell?.formula || "";
        formulaInputValueRef.current = cellFormula;
        setFormulaInput(cellFormula);
        setFormulaCursorPosition(cellFormula.length);
        setIsFormulaBuildingMode(cellFormula.startsWith("="));
        setRangeSelectionStart(null);
        setIsAddingToFormula(false);
        // Exit inline editing when selecting a new cell
        setEditingCell(null);
      });
    },
    [cells],
  );

  // Helper: Get merge info for a cell if it's part of a merged region
  const getMergeInfoForCell = useCallback(
    (row: number, col: number) => {
      if (!currentSheet?.mergedCells) return null;

      return (
        currentSheet.mergedCells.find((merge) => {
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
    },
    [currentSheet?.mergedCells],
  );

  // Navigate to adjacent cell
  const navigateCell = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const currentPos = parseCellRef(selectedCell);
      if (!currentPos) return;

      // Check if current cell is part of a merge
      const currentMerge = getMergeInfoForCell(currentPos.row, currentPos.col);

      let newRow = currentPos.row;
      let newCol = currentPos.col;

      // If we're in a merged cell, we need to navigate from the edge of the merge
      if (currentMerge) {
        const mergeStart = parseCellRef(currentMerge.startCell);
        const mergeEnd = parseCellRef(currentMerge.endCell);
        if (!mergeStart || !mergeEnd) return;

        switch (direction) {
          case "up":
            // Start from the top edge of the merge
            newRow = mergeStart.row - 1;
            break;
          case "down":
            // Start from the bottom edge of the merge
            newRow = mergeEnd.row + 1;
            break;
          case "left":
            // Start from the left edge of the merge
            newCol = mergeStart.col - 1;
            break;
          case "right":
            // Start from the right edge of the merge
            newCol = mergeEnd.col + 1;
            break;
        }
      } else {
        // Normal navigation from a single cell
        switch (direction) {
          case "up":
            newRow = currentPos.row - 1;
            break;
          case "down":
            newRow = currentPos.row + 1;
            break;
          case "left":
            newCol = currentPos.col - 1;
            break;
          case "right":
            newCol = currentPos.col + 1;
            break;
        }
      }

      // Skip hidden rows/columns
      if (direction === "up" || direction === "down") {
        while (newRow >= 0 && newRow < ROWS && hiddenRows.has(newRow)) {
          newRow += direction === "down" ? 1 : -1;
        }
        newRow = Math.max(0, Math.min(ROWS - 1, newRow));
      } else {
        while (newCol >= 0 && newCol < COLS && hiddenColumns.has(newCol)) {
          newCol += direction === "right" ? 1 : -1;
        }
        newCol = Math.max(0, Math.min(COLS - 1, newCol));
      }

      // Check if the target cell is part of a merge
      const targetMerge = getMergeInfoForCell(newRow, newCol);
      if (targetMerge) {
        // Navigate to the master cell (top-left) of the merge
        const mergeStart = parseCellRef(targetMerge.startCell);
        if (mergeStart) {
          newRow = mergeStart.row;
          newCol = mergeStart.col;
        }
      }

      const newCellRef = getCellRef(newRow, newCol);
      selectCell(newCellRef);
    },
    [
      selectedCell,
      selectCell,
      hiddenRows,
      hiddenColumns,
      getMergeInfoForCell,
      currentSheet,
    ],
  );

  // Handle resize start
  const handleResizeStart = (
    e: React.MouseEvent,
    type: "column" | "row",
    index: number,
    currentSize: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing({
      type,
      index,
      startPos: type === "column" ? e.clientX : e.clientY,
      startSize: currentSize,
    });
  };

  // Handle resize during mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing.type === null) return;

      const currentPos = isResizing.type === "column" ? e.clientX : e.clientY;
      const rawDelta = currentPos - isResizing.startPos;
      // Divide by zoom scale so stored logical size stays correct
      const delta = rawDelta / (zoom / 100);
      const newSize = Math.max(
        isResizing.type === "column" ? MIN_COLUMN_WIDTH : MIN_ROW_HEIGHT,
        isResizing.startSize + delta,
      );

      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            if (isResizing.type === "column") {
              return {
                ...sheet,
                columnWidths: {
                  ...sheet.columnWidths,
                  [isResizing.index]: newSize,
                },
              };
            } else {
              return {
                ...sheet,
                rowHeights: {
                  ...sheet.rowHeights,
                  [isResizing.index]: newSize,
                },
              };
            }
          }
          return sheet;
        }),
      );
    };

    const handleMouseUp = () => {
      setIsResizing({ type: null, index: -1, startPos: 0, startSize: 0 });
    };

    if (isResizing.type !== null) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, activeSheetId, zoom]);

  // Hide/Unhide functions
  const hideRow = useCallback(
    (rowIndex: number) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            const newUserHiddenRows = new Set(sheet.userHiddenRows);
            newUserHiddenRows.add(rowIndex);
            return {
              ...sheet,
              userHiddenRows: newUserHiddenRows,
            };
          }
          return sheet;
        }),
      );
      setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
    },
    [activeSheetId],
  );

  const hideColumn = useCallback(
    (columnIndex: number) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            const newUserHiddenColumns = new Set(sheet.userHiddenColumns);
            newUserHiddenColumns.add(columnIndex);
            return {
              ...sheet,
              userHiddenColumns: newUserHiddenColumns,
            };
          }
          return sheet;
        }),
      );
      setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
    },
    [activeSheetId],
  );

  const unhideRow = useCallback(
    (rowIndex: number) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            const newUserHiddenRows = new Set(sheet.userHiddenRows);
            newUserHiddenRows.delete(rowIndex);
            return {
              ...sheet,
              userHiddenRows: newUserHiddenRows,
            };
          }
          return sheet;
        }),
      );
    },
    [activeSheetId],
  );

  const unhideColumn = useCallback(
    (columnIndex: number) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            const newUserHiddenColumns = new Set(sheet.userHiddenColumns);
            newUserHiddenColumns.delete(columnIndex);
            return {
              ...sheet,
              userHiddenColumns: newUserHiddenColumns,
            };
          }
          return sheet;
        }),
      );
    },
    [activeSheetId],
  );

  const unhideAllRows = useCallback(() => {
    setSheets((prevSheets) =>
      prevSheets.map((sheet) => {
        if (sheet.id === activeSheetId) {
          return {
            ...sheet,
            userHiddenRows: new Set<number>(),
          };
        }
        return sheet;
      }),
    );
  }, [activeSheetId]);

  const hideCell = useCallback(
    (cellRef: string) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            const newHiddenCells = new Set(
              sheet.hiddenCells || new Set<string>(),
            );
            newHiddenCells.add(cellRef);
            return {
              ...sheet,
              hiddenCells: newHiddenCells,
            };
          }
          return sheet;
        }),
      );
      setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
    },
    [activeSheetId],
  );

  const unhideCell = useCallback(
    (cellRef: string) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            const newHiddenCells = new Set(
              sheet.hiddenCells || new Set<string>(),
            );
            newHiddenCells.delete(cellRef);
            return {
              ...sheet,
              hiddenCells: newHiddenCells,
            };
          }
          return sheet;
        }),
      );
      setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
    },
    [activeSheetId],
  );

  const freezePanes = useCallback(
    (row: number, column: number) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            return {
              ...sheet,
              freezeRow: row,
              freezeColumn: column,
            };
          }
          return sheet;
        }),
      );
      setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
    },
    [activeSheetId],
  );

  const unfreezePanes = useCallback(() => {
    setSheets((prevSheets) =>
      prevSheets.map((sheet) => {
        if (sheet.id === activeSheetId) {
          return {
            ...sheet,
            freezeRow: 0,
            freezeColumn: 0,
          };
        }
        return sheet;
      }),
    );
    setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
  }, [activeSheetId]);

  const freezeRowsOnly = useCallback(
    (upToRow: number) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            return {
              ...sheet,
              freezeRow: upToRow,
            };
          }
          return sheet;
        }),
      );
      setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
    },
    [activeSheetId],
  );

  const unfreezeRows = useCallback(() => {
    setSheets((prevSheets) =>
      prevSheets.map((sheet) => {
        if (sheet.id === activeSheetId) {
          return {
            ...sheet,
            freezeRow: 0,
          };
        }
        return sheet;
      }),
    );
    setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
  }, [activeSheetId]);

  const freezeColumnsOnly = useCallback(
    (upToCol: number) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            return {
              ...sheet,
              freezeColumn: upToCol,
            };
          }
          return sheet;
        }),
      );
      setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
    },
    [activeSheetId],
  );

  const unfreezeColumns = useCallback(() => {
    setSheets((prevSheets) =>
      prevSheets.map((sheet) => {
        if (sheet.id === activeSheetId) {
          return {
            ...sheet,
            freezeColumn: 0,
          };
        }
        return sheet;
      }),
    );
    setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
  }, [activeSheetId]);

  const unhideAllColumns = useCallback(() => {
    setSheets((prevSheets) =>
      prevSheets.map((sheet) => {
        if (sheet.id === activeSheetId) {
          return {
            ...sheet,
            userHiddenColumns: new Set<number>(),
          };
        }
        return sheet;
      }),
    );
  }, [activeSheetId]);

  // Merge cells function
  const mergeCells = useCallback(() => {
    if (selectedCells.size < 2) return; // Need at least 2 cells to merge

    // Get cell coordinates for all selected cells
    const cellCoords = Array.from(selectedCells)
      .map((cellRef) => {
        const pos = parseCellRef(cellRef);
        return pos ? { cellRef, ...pos } : null;
      })
      .filter(
        (coord): coord is { cellRef: string; row: number; col: number } =>
          coord !== null,
      );

    if (cellCoords.length < 2) return;

    // Find the bounding box
    const minRow = Math.min(...cellCoords.map((c) => c.row));
    const maxRow = Math.max(...cellCoords.map((c) => c.row));
    const minCol = Math.min(...cellCoords.map((c) => c.col));
    const maxCol = Math.max(...cellCoords.map((c) => c.col));

    const startCell = getCellRef(minRow, minCol);
    const endCell = getCellRef(maxRow, maxCol);
    const rowSpan = maxRow - minRow + 1;
    const colSpan = maxCol - minCol + 1;

    setSheets((prevSheets) =>
      prevSheets.map((sheet) => {
        if (sheet.id === activeSheetId) {
          // Check if any cell in the range is already part of a merge
          const existingMerge = sheet.mergedCells.find((merge) => {
            const mergeStart = parseCellRef(merge.startCell);
            const mergeEnd = parseCellRef(merge.endCell);
            if (!mergeStart || !mergeEnd) return false;

            // Check for overlap
            for (let r = minRow; r <= maxRow; r++) {
              for (let c = minCol; c <= maxCol; c++) {
                if (
                  r >= mergeStart.row &&
                  r <= mergeEnd.row &&
                  c >= mergeStart.col &&
                  c <= mergeEnd.col
                ) {
                  return true;
                }
              }
            }
            return false;
          });

          if (existingMerge) {
            // Don't merge if there's overlap
            return sheet;
          }

          return {
            ...sheet,
            mergedCells: [
              ...sheet.mergedCells,
              { startCell, endCell, rowSpan, colSpan },
            ],
          };
        }
        return sheet;
      }),
    );
    setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
  }, [activeSheetId, selectedCells]);

  // Unmerge cells function
  const unmergeCells = useCallback(() => {
    if (selectedCells.size === 0) return;

    const selectedCellRef = Array.from(selectedCells)[0];
    const pos = parseCellRef(selectedCellRef);
    if (!pos) return;

    setSheets((prevSheets) =>
      prevSheets.map((sheet) => {
        if (sheet.id === activeSheetId) {
          // Find the merge that contains the selected cell
          const mergeToRemove = sheet.mergedCells.find((merge) => {
            const mergeStart = parseCellRef(merge.startCell);
            const mergeEnd = parseCellRef(merge.endCell);
            if (!mergeStart || !mergeEnd) return false;

            return (
              pos.row >= mergeStart.row &&
              pos.row <= mergeEnd.row &&
              pos.col >= mergeStart.col &&
              pos.col <= mergeEnd.col
            );
          });

          if (!mergeToRemove) return sheet;

          return {
            ...sheet,
            mergedCells: sheet.mergedCells.filter(
              (merge) => merge !== mergeToRemove,
            ),
          };
        }
        return sheet;
      }),
    );
    setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
  }, [activeSheetId, selectedCells]);

  // Context menu handlers
  const handleRowHeaderContextMenu = useCallback(
    (e: React.MouseEvent, rowIndex: number) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        type: "row",
        index: rowIndex,
      });
    },
    [],
  );

  const handleColumnHeaderContextMenu = useCallback(
    (e: React.MouseEvent, columnIndex: number) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        type: "column",
        index: columnIndex,
      });
    },
    [],
  );

  const handleCellContextMenu = useCallback(
    (e: React.MouseEvent, cellRef: string) => {
      e.preventDefault();
      const pos = parseCellRef(cellRef);
      if (!pos) return;

      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        type: "cell",
        index: -1,
        cellRef: cellRef,
      });
    },
    [],
  );

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [contextMenu.visible]);

  // Update cursor position from input
  const updateCursorPosition = () => {
    if (formulaInputRef.current) {
      setFormulaCursorPosition(formulaInputRef.current.selectionStart || 0);
    }
  };

  // Set cursor position in input
  const setCursorPosition = (position: number) => {
    if (formulaInputRef.current) {
      formulaInputRef.current.setSelectionRange(position, position);
      formulaInputRef.current.focus();
      setFormulaCursorPosition(position);
    }
  };

  // Function library state
  const customFunctions = useMemo(
    () =>
      subTypeWithFunctions.designFunctions
        ?.filter((func) => func.type === instanceId.toUpperCase())
        .map((func) => {
          return {
            id: func.id,
            name: func.name,
            code: func.code,
            formula: func.expression,
            variables: func.variables.split(",").map((v) => v.trim()),
            description: func.description || "",
          };
        }) || [],
    [subTypeWithFunctions.designFunctions],
  );

  // Evaluate custom function
  const evaluateCustomFunction = useCallback(
    async (
      funcName: string,
      args: string[],
      _cellGrid: CellGrid,
      currentSheets: typeof sheets,
    ): Promise<number | string> => {
      const func = customFunctions.find((f) => f.code === funcName);
      if (!func) return "#FUNCTION_NOT_FOUND";

      if (args.length === 0) {
        return "#MISSING_ARGS";
      }

      try {
        // Parse arguments and replace with actual values
        const values: { [key: string]: number } = {};

        for (let i = 0; i < func.variables.length && i < args.length; i++) {
          const arg = args[i].trim();
          if (!arg) {
            return "#MISSING_ARGUMENT";
          }

          let value: number;

          // Check if argument is a cell reference (including cross-sheet)
          if (/^([A-Z]+\d+|.+![A-Z]+\d+)$/.test(arg)) {
            const cellValue = getCellValueFromAnySheet(arg, currentSheets);
            value = typeof cellValue === "number" ? cellValue : 0;
          } else {
            value = Number.parseFloat(arg);
            if (isNaN(value)) return "#INVALID_ARGUMENT";
          }

          values[func.variables[i]] = value;
        }

        if (Object.keys(values).length !== func.variables.length) {
          return "#MISSING_ARGS";
        }

        const resultData = await evaluateFunction({
          functions: [
            {
              designFunctionId: Number(func.id),
              parameters: values,
            },
          ],
        }).unwrap();

        const resultValue = resultData.results[0]?.result;

        return Number(resultValue);
      } catch {
        return "#ERROR";
      }
    },
    [customFunctions, evaluateFunction, getCellValueFromAnySheet],
  );

  // Evaluate formula
  const evaluateFormula = useCallback(
    async (
      formula: string,
      cellGrid: CellGrid,
      currentSheets: typeof sheets,
    ): Promise<number | string | undefined> => {
      if (!formula || formula.trim() === "") {
        return "";
      }

      if (!formula.startsWith("=")) {
        const num = Number.parseFloat(formula);
        return isNaN(num) ? formula : num;
      }

      let expression = formula.slice(1).trim(); // Remove '=' and trim

      if (!expression) {
        return "#ERROR";
      }

      try {
        for (const func of customFunctions) {
          const funcRegex = new RegExp(`${func.code}\\(([^)]*)\\)`, "g");

          const matches = expression.match(funcRegex);
          if (matches) {
            for (const match of matches) {
              const argsStr = match.substring(
                func.code.length + 1,
                match.length - 1,
              );
              if (!argsStr.trim()) {
                expression = expression.replace(match, "#MISSING_ARGS");
                continue;
              }

              const args = argsStr
                .split(",")
                .map((arg: string) => arg.trim())
                .filter((arg: unknown) => arg !== "");

              if (args.length === 0) {
                expression = expression.replace(match, "#MISSING_ARGS");
                continue;
              }

              // Now properly await the async result
              const result = await evaluateCustomFunction(
                func.code,
                args,
                cellGrid,
                currentSheets,
              );
              return result;
            }
          }
        }

        expression = expression.replace(/SUM$$([^)]*)$$/g, (_, range) => {
          if (!range.trim()) {
            return "0";
          }
          const refs = range
            .split(",")
            .map((ref: string) => ref.trim())
            .filter((ref: unknown) => ref !== "");
          let sum = 0;
          refs.forEach((ref: string) => {
            if (ref.includes(":") && !ref.includes("!")) {
              // Range like A1:A5 (same sheet only)
              const [start, end] = ref.split(":");
              const startPos = parseCellRef(start.trim());
              const endPos = parseCellRef(end.trim());
              if (startPos && endPos) {
                for (let r = startPos.row; r <= endPos.row; r++) {
                  for (let c = startPos.col; c <= endPos.col; c++) {
                    const cellRef = getCellRef(r, c);
                    const cell = cellGrid[cellRef];
                    if (cell && typeof cell.computed === "number") {
                      sum += cell.computed;
                    }
                  }
                }
              }
            } else {
              // Single cell reference (may be cross-sheet)
              const cellValue = getCellValueFromAnySheet(ref, currentSheets);
              if (typeof cellValue === "number") {
                sum += cellValue;
              }
            }
          });
          return sum.toString();
        });

        expression = expression.replace(/AVERAGE$$([^)]*)$$/g, (_, range) => {
          if (!range.trim()) {
            return "0";
          }
          const refs = range
            .split(",")
            .map((ref: string) => ref.trim())
            .filter((ref: unknown) => ref !== "");
          let sum = 0;
          let count = 0;
          refs.forEach((ref: string) => {
            if (ref.includes(":") && !ref.includes("!")) {
              // Range like A1:A5 (same sheet only)
              const [start, end] = ref.split(":");
              const startPos = parseCellRef(start.trim());
              const endPos = parseCellRef(end.trim());
              if (startPos && endPos) {
                for (let r = startPos.row; r <= endPos.row; r++) {
                  for (let c = startPos.col; c <= endPos.col; c++) {
                    const cellRef = getCellRef(r, c);
                    const cell = cellGrid[cellRef];
                    if (cell && typeof cell.computed === "number") {
                      sum += cell.computed;
                      count++;
                    }
                  }
                }
              }
            } else {
              // Single cell reference (may be cross-sheet)
              const cellValue = getCellValueFromAnySheet(ref, currentSheets);
              if (typeof cellValue === "number") {
                sum += cellValue;
                count++;
              }
            }
          });
          return count > 0 ? (sum / count).toString() : "0";
        });

        // BUSCARV (VLOOKUP) function
        expression = expression.replace(/BUSCARV\(([^)]*)\)/g, (_, args) => {
          if (!args.trim()) {
            return "0";
          }

          // Support both comma and semicolon as separators (regional formats)
          const normalizedArgs = args.replace(/;/g, ",");
          const params = normalizedArgs
            .split(",")
            .map((param: string) => param.trim())
            .filter((param: unknown) => param !== "");

          if (params.length < 3) {
            return "0";
          }

          const lookupValue = params[0];
          let tableRange = params[1];
          const columnIndex = Number.parseInt(params[2]);
          const exactMatch = params[3]
            ? params[3].toLowerCase() === "true" || params[3] === "1"
            : true;

          if (isNaN(columnIndex) || columnIndex < 1) {
            return "0";
          }

          // Parse the table range - support cross-sheet references
          if (!tableRange.includes(":")) {
            return "0";
          }

          // Handle cross-sheet references: Tablas!B3:C10 or Tablas!B3:Tablas!C10
          let targetSheetName: string | null = null;
          let targetCellGrid = cellGrid;

          if (tableRange.includes("!")) {
            // Extract sheet name and normalize the range
            const parts = tableRange.split(":");
            let startPart = parts[0];
            let endPart = parts[1];

            // Extract sheet name from start part
            if (startPart.includes("!")) {
              const sheetAndCell = startPart.split("!");
              targetSheetName = sheetAndCell[0];
              startPart = sheetAndCell[1];
            }

            // If end part also has sheet reference, remove it
            if (endPart.includes("!")) {
              endPart = endPart.split("!")[1];
            }

            // Reconstruct the range without sheet references
            tableRange = `${startPart}:${endPart}`;

            // Find the target sheet
            if (targetSheetName) {
              const targetSheet = currentSheets.find(
                (s) => s.name === targetSheetName || s.id === targetSheetName,
              );
              if (targetSheet) {
                targetCellGrid = targetSheet.cells;
              } else {
                return "0";
              }
            }
          }

          const [start, end] = tableRange.split(":");
          const startPos = parseCellRef(start.trim());
          const endPos = parseCellRef(end.trim());

          if (!startPos || !endPos) {
            return "0";
          }

          // Get the lookup value - evaluate expressions like I39*10
          let searchValue: string | number;
          // Replace cell references in the lookup value with actual values
          let evaluatedLookup = lookupValue.replace(
            /\$?([A-Za-z0-9]+:[A-Za-z0-9]+!|[A-Za-z0-9]+!)?\$?[A-Z]+\$?\d+/g,
            (match: string) => {
              const cleanMatch = match.replace(/\$/g, "");
              const cellValue = getCellValueFromAnySheet(
                cleanMatch,
                currentSheets,
              );
              if (typeof cellValue === "number") {
                return cellValue.toString();
              }
              return "0";
            },
          );

          // Try to evaluate if it's a math expression
          try {
            const evaluated = Function(
              `"use strict"; return (${evaluatedLookup})`,
            )();
            if (typeof evaluated === "number" && !isNaN(evaluated)) {
              searchValue = evaluated;
            } else if (!isNaN(Number.parseFloat(evaluatedLookup))) {
              searchValue = Number.parseFloat(evaluatedLookup);
            } else {
              // Remove quotes if it's a string literal
              searchValue = lookupValue.replace(/^["']|["']$/g, "");
            }
          } catch {
            // If evaluation fails, try parsing as number or use as string
            if (!isNaN(Number.parseFloat(evaluatedLookup))) {
              searchValue = Number.parseFloat(evaluatedLookup);
            } else {
              searchValue = lookupValue.replace(/^["']|["']$/g, "");
            }
          }

          // Check if column index is within the range
          const tableWidth = endPos.col - startPos.col + 1;
          if (columnIndex > tableWidth) {
            return "0";
          }

          // Search in the first column of the range
          let lastMatchRow = -1;
          for (let r = startPos.row; r <= endPos.row; r++) {
            const lookupCellRef = getCellRef(r, startPos.col);
            const lookupCell = targetCellGrid[lookupCellRef];

            let cellValue: string | number = "";
            if (lookupCell) {
              cellValue =
                typeof lookupCell.computed === "number"
                  ? lookupCell.computed
                  : (lookupCell.computed || lookupCell.value || "").toString();
            }

            // Compare values
            let isMatch = false;
            if (exactMatch) {
              if (
                typeof searchValue === "number" &&
                typeof cellValue === "number"
              ) {
                isMatch = Math.abs(searchValue - cellValue) < 0.0001;
              } else {
                isMatch =
                  String(cellValue).toLowerCase() ===
                  String(searchValue).toLowerCase();
              }
            } else {
              // Approximate match (for sorted data)
              if (
                typeof searchValue === "number" &&
                typeof cellValue === "number"
              ) {
                if (cellValue <= searchValue) {
                  lastMatchRow = r;
                }
                if (cellValue > searchValue) {
                  break;
                }
              } else {
                if (
                  String(cellValue).toLowerCase() <=
                  String(searchValue).toLowerCase()
                ) {
                  lastMatchRow = r;
                }
                if (
                  String(cellValue).toLowerCase() >
                  String(searchValue).toLowerCase()
                ) {
                  break;
                }
              }
              continue;
            }

            if (isMatch) {
              // Return value from the specified column
              const resultCol = startPos.col + columnIndex - 1;
              const resultCellRef = getCellRef(r, resultCol);
              const resultCell = targetCellGrid[resultCellRef];

              if (resultCell) {
                const resultValue =
                  typeof resultCell.computed === "number"
                    ? resultCell.computed
                    : resultCell.computed || resultCell.value || "";
                return typeof resultValue === "number"
                  ? resultValue.toString()
                  : "0";
              }

              return "0";
            }
          }

          // For approximate match, return the last matching row
          if (!exactMatch && lastMatchRow >= 0) {
            const resultCol = startPos.col + columnIndex - 1;
            const resultCellRef = getCellRef(lastMatchRow, resultCol);
            const resultCell = targetCellGrid[resultCellRef];

            if (resultCell) {
              const resultValue =
                typeof resultCell.computed === "number"
                  ? resultCell.computed
                  : resultCell.computed || resultCell.value || "";
              return typeof resultValue === "number"
                ? resultValue.toString()
                : "0";
            }
          }

          return "0";
        });

        // VLOOKUP function (English version)
        expression = expression.replace(/VLOOKUP\(([^)]*)\)/g, (_, args) => {
          if (!args.trim()) {
            return "0";
          }

          // Support both comma and semicolon as separators (regional formats)
          const normalizedArgs = args.replace(/;/g, ",");
          const params = normalizedArgs
            .split(",")
            .map((param: string) => param.trim())
            .filter((param: unknown) => param !== "");

          if (params.length < 3) {
            return "0";
          }

          const lookupValue = params[0];
          let tableRange = params[1];
          const columnIndex = Number.parseInt(params[2]);
          const exactMatch = params[3]
            ? params[3].toLowerCase() === "true" || params[3] === "1"
            : true;

          if (isNaN(columnIndex) || columnIndex < 1) {
            return "0";
          }

          // Parse the table range - support cross-sheet references
          if (!tableRange.includes(":")) {
            return "0";
          }

          // Handle cross-sheet references: Tablas!B3:C10 or Tablas!B3:Tablas!C10
          let targetSheetName: string | null = null;
          let targetCellGrid = cellGrid;

          if (tableRange.includes("!")) {
            // Extract sheet name and normalize the range
            const parts = tableRange.split(":");
            let startPart = parts[0];
            let endPart = parts[1];

            // Extract sheet name from start part
            if (startPart.includes("!")) {
              const sheetAndCell = startPart.split("!");
              targetSheetName = sheetAndCell[0];
              startPart = sheetAndCell[1];
            }

            // If end part also has sheet reference, remove it
            if (endPart.includes("!")) {
              endPart = endPart.split("!")[1];
            }

            // Reconstruct the range without sheet references
            tableRange = `${startPart}:${endPart}`;

            // Find the target sheet
            if (targetSheetName) {
              const targetSheet = currentSheets.find(
                (s) => s.name === targetSheetName || s.id === targetSheetName,
              );
              if (targetSheet) {
                targetCellGrid = targetSheet.cells;
              } else {
                return "0";
              }
            }
          }

          const [start, end] = tableRange.split(":");
          const startPos = parseCellRef(start.trim());
          const endPos = parseCellRef(end.trim());

          if (!startPos || !endPos) {
            return "0";
          }

          // Get the lookup value - evaluate expressions like I39*10
          let searchValue: string | number;
          // Replace cell references in the lookup value with actual values
          let evaluatedLookup = lookupValue.replace(
            /\$?([A-Za-z0-9]+:[A-Za-z0-9]+!|[A-Za-z0-9]+!)?\$?[A-Z]+\$?\d+/g,
            (match: string) => {
              const cleanMatch = match.replace(/\$/g, "");
              const cellValue = getCellValueFromAnySheet(
                cleanMatch,
                currentSheets,
              );
              if (typeof cellValue === "number") {
                return cellValue.toString();
              }
              return "0";
            },
          );

          // Try to evaluate if it's a math expression
          try {
            const evaluated = Function(
              `"use strict"; return (${evaluatedLookup})`,
            )();
            if (typeof evaluated === "number" && !isNaN(evaluated)) {
              searchValue = evaluated;
            } else if (!isNaN(Number.parseFloat(evaluatedLookup))) {
              searchValue = Number.parseFloat(evaluatedLookup);
            } else {
              // Remove quotes if it's a string literal
              searchValue = lookupValue.replace(/^["']|["']$/g, "");
            }
          } catch {
            // If evaluation fails, try parsing as number or use as string
            if (!isNaN(Number.parseFloat(evaluatedLookup))) {
              searchValue = Number.parseFloat(evaluatedLookup);
            } else {
              searchValue = lookupValue.replace(/^["']|["']$/g, "");
            }
          }

          // Check if column index is within the range
          const tableWidth = endPos.col - startPos.col + 1;
          if (columnIndex > tableWidth) {
            return "0";
          }

          // Search in the first column of the range
          let lastMatchRow = -1;
          for (let r = startPos.row; r <= endPos.row; r++) {
            const lookupCellRef = getCellRef(r, startPos.col);
            const lookupCell = targetCellGrid[lookupCellRef];

            let cellValue: string | number = "";
            if (lookupCell) {
              cellValue =
                typeof lookupCell.computed === "number"
                  ? lookupCell.computed
                  : (lookupCell.computed || lookupCell.value || "").toString();
            }

            // Compare values
            let isMatch = false;
            if (exactMatch) {
              if (
                typeof searchValue === "number" &&
                typeof cellValue === "number"
              ) {
                isMatch = Math.abs(searchValue - cellValue) < 0.0001;
              } else {
                isMatch =
                  String(cellValue).toLowerCase() ===
                  String(searchValue).toLowerCase();
              }
            } else {
              // Approximate match (for sorted data)
              if (
                typeof searchValue === "number" &&
                typeof cellValue === "number"
              ) {
                if (cellValue <= searchValue) {
                  lastMatchRow = r;
                }
                if (cellValue > searchValue) {
                  break;
                }
              } else {
                if (
                  String(cellValue).toLowerCase() <=
                  String(searchValue).toLowerCase()
                ) {
                  lastMatchRow = r;
                }
                if (
                  String(cellValue).toLowerCase() >
                  String(searchValue).toLowerCase()
                ) {
                  break;
                }
              }
              continue;
            }

            if (isMatch) {
              // Return value from the specified column
              const resultCol = startPos.col + columnIndex - 1;
              const resultCellRef = getCellRef(r, resultCol);
              const resultCell = targetCellGrid[resultCellRef];

              if (resultCell) {
                const resultValue =
                  typeof resultCell.computed === "number"
                    ? resultCell.computed
                    : resultCell.computed || resultCell.value || "";
                return typeof resultValue === "number"
                  ? resultValue.toString()
                  : "0";
              }

              return "0";
            }
          }

          // For approximate match, return the last matching row
          if (!exactMatch && lastMatchRow >= 0) {
            const resultCol = startPos.col + columnIndex - 1;
            const resultCellRef = getCellRef(lastMatchRow, resultCol);
            const resultCell = targetCellGrid[resultCellRef];

            if (resultCell) {
              const resultValue =
                typeof resultCell.computed === "number"
                  ? resultCell.computed
                  : resultCell.computed || resultCell.value || "";
              return typeof resultValue === "number"
                ? resultValue.toString()
                : "0";
            }
          }

          return "0";
        });

        // COINCIDIR (MATCH) function - Returns position of a value in a range or array
        expression = expression.replace(/COINCIDIR\(([^)]*)\)/g, (_, args) => {
          if (!args.trim()) {
            return "0";
          }

          const params = args
            .split(/,(?![^{]*\})/) // Split by comma, but not inside braces
            .map((param: string) => param.trim())
            .filter((param: unknown) => param !== "");

          if (params.length < 2) {
            return "0";
          }

          const lookupValueParam = params[0];
          const rangeParam = params[1];
          const matchType = params[2] ? Number.parseInt(params[2]) : 0; // 0=exact, 1=less/equal, -1=greater/equal

          // Get the lookup value
          let searchValue: string | number;
          // Check if it's a cell reference (with or without $ symbols): C21, $C$21, $C21, C$21
          if (/^\$?[A-Z]+\$?\d+$/.test(lookupValueParam)) {
            const cleanRef = lookupValueParam.replace(/\$/g, "");
            searchValue = getCellValueFromAnySheet(cleanRef, currentSheets);
          } else if (!isNaN(Number.parseFloat(lookupValueParam))) {
            searchValue = Number.parseFloat(lookupValueParam);
          } else {
            searchValue = lookupValueParam.replace(/^["']|["']$/g, "");
          }

          // Parse the range/array
          let values: (string | number)[] = [];

          if (rangeParam.startsWith("{") && rangeParam.endsWith("}")) {
            // Array notation: {1;2;4;9;13;20}
            const arrayContent = rangeParam.slice(1, -1);
            values = arrayContent.split(";").map((v: string) => {
              const val = v.trim();
              return !isNaN(Number.parseFloat(val))
                ? Number.parseFloat(val)
                : val;
            });
          } else if (rangeParam.includes(":")) {
            // Range notation: A1:A10
            const [start, end] = rangeParam.split(":");
            const startPos = parseCellRef(start.trim());
            const endPos = parseCellRef(end.trim());

            if (startPos && endPos) {
              // Handle both row and column ranges
              if (startPos.col === endPos.col) {
                // Column range (vertical)
                for (let r = startPos.row; r <= endPos.row; r++) {
                  const cellRef = getCellRef(r, startPos.col);
                  const cellValue = cellGrid[cellRef];
                  if (cellValue) {
                    values.push(
                      typeof cellValue.computed === "number"
                        ? cellValue.computed
                        : cellValue.computed || cellValue.value || "",
                    );
                  } else {
                    values.push("");
                  }
                }
              } else if (startPos.row === endPos.row) {
                // Row range (horizontal)
                for (let c = startPos.col; c <= endPos.col; c++) {
                  const cellRef = getCellRef(startPos.row, c);
                  const cellValue = cellGrid[cellRef];
                  if (cellValue) {
                    values.push(
                      typeof cellValue.computed === "number"
                        ? cellValue.computed
                        : cellValue.computed || cellValue.value || "",
                    );
                  } else {
                    values.push("");
                  }
                }
              }
            }
          }

          // Search for the value based on match type
          if (matchType === 0) {
            // Exact match
            for (let i = 0; i < values.length; i++) {
              const cellValue = values[i];
              if (
                typeof searchValue === "number" &&
                typeof cellValue === "number"
              ) {
                if (Math.abs(searchValue - cellValue) < 0.0001) {
                  return (i + 1).toString();
                }
              } else {
                if (
                  String(cellValue).toLowerCase() ===
                  String(searchValue).toLowerCase()
                ) {
                  return (i + 1).toString();
                }
              }
            }
          } else if (matchType === 1) {
            // Less than or equal (assumes sorted ascending)
            let lastMatch = -1;
            for (let i = 0; i < values.length; i++) {
              const cellValue = values[i];
              if (
                typeof searchValue === "number" &&
                typeof cellValue === "number"
              ) {
                if (cellValue <= searchValue) {
                  lastMatch = i;
                } else {
                  break;
                }
              }
            }
            if (lastMatch >= 0) {
              return (lastMatch + 1).toString();
            }
          } else if (matchType === -1) {
            // Greater than or equal (assumes sorted descending)
            for (let i = 0; i < values.length; i++) {
              const cellValue = values[i];
              if (
                typeof searchValue === "number" &&
                typeof cellValue === "number"
              ) {
                if (cellValue >= searchValue) {
                  return (i + 1).toString();
                }
              }
            }
          }

          return "0";
        });

        // Helper function to find matching closing parenthesis
        const findClosingParen = (str: string, startIndex: number): number => {
          let depth = 1;
          for (let i = startIndex; i < str.length; i++) {
            if (str[i] === "(") depth++;
            if (str[i] === ")") {
              depth--;
              if (depth === 0) return i;
            }
          }
          return -1;
        };

        // Helper function to split arguments respecting nested functions and arrays
        const splitFunctionArgs = (argsString: string): string[] => {
          const args: string[] = [];
          let currentArg = "";
          let depth = 0;
          let inBraces = false;

          for (let i = 0; i < argsString.length; i++) {
            const char = argsString[i];

            if (char === "{") {
              inBraces = true;
            } else if (char === "}") {
              inBraces = false;
            } else if (char === "(" && !inBraces) {
              depth++;
            } else if (char === ")" && !inBraces) {
              depth--;
            }

            if (char === ";" && depth === 0 && !inBraces) {
              args.push(currentArg.trim());
              currentArg = "";
            } else if (char === "," && depth === 0 && !inBraces) {
              args.push(currentArg.trim());
              currentArg = "";
            } else {
              currentArg += char;
            }
          }

          if (currentArg.trim()) {
            args.push(currentArg.trim());
          }

          return args.filter((arg) => arg !== "");
        };

        // ELEGIR (CHOOSE) function - Returns a value from a list based on index
        // Process multiple times to handle nested ELEGIR functions
        let elegirProcessed = true;
        while (elegirProcessed) {
          elegirProcessed = false;
          const elegirIndex = expression.indexOf("ELEGIR(");

          if (elegirIndex !== -1) {
            const closingIndex = findClosingParen(expression, elegirIndex + 7);

            if (closingIndex !== -1) {
              const fullMatch = expression.substring(
                elegirIndex,
                closingIndex + 1,
              );
              const argsString = expression.substring(
                elegirIndex + 7,
                closingIndex,
              );
              const params = splitFunctionArgs(argsString);

              if (params.length >= 2) {
                // First parameter is the index
                const indexParam = params[0];
                let index: number;

                // Check if it's directly a number
                if (
                  !isNaN(Number.parseFloat(indexParam)) &&
                  !/[A-Z]/.test(indexParam)
                ) {
                  index = Math.floor(Number.parseFloat(indexParam));
                } else if (/^\$?[A-Z]+\$?\d+$/.test(indexParam)) {
                  // It's a cell reference (with or without $ symbols): C21, $C$21, etc.
                  const cleanRef = indexParam.replace(/\$/g, "");
                  const cellValue = getCellValueFromAnySheet(
                    cleanRef,
                    currentSheets,
                  );
                  index =
                    typeof cellValue === "number" ? Math.floor(cellValue) : 0;
                } else {
                  // Skip this iteration, might be another function that needs processing first
                  break;
                }

                let result = "0";
                if (index >= 1 && index <= params.length - 1) {
                  // Get the value at the specified index (1-based)
                  const selectedParam = params[index];

                  // Check if it's a cell reference (with or without $ symbols): K25, $K25, etc.
                  if (/^\$?[A-Z]+\$?\d+$/.test(selectedParam)) {
                    const cleanRef = selectedParam.replace(/\$/g, "");
                    const cellValue = getCellValueFromAnySheet(
                      cleanRef,
                      currentSheets,
                    );
                    result =
                      typeof cellValue === "number"
                        ? cellValue.toString()
                        : "0";
                  } else if (
                    !isNaN(Number.parseFloat(selectedParam)) &&
                    !/[A-Z]/.test(selectedParam)
                  ) {
                    result = selectedParam;
                  } else {
                    // Keep the parameter as-is (might be another expression)
                    result = selectedParam;
                  }
                }

                expression =
                  expression.substring(0, elegirIndex) +
                  result +
                  expression.substring(closingIndex + 1);
                elegirProcessed = true;
              } else {
                expression =
                  expression.substring(0, elegirIndex) +
                  "0" +
                  expression.substring(closingIndex + 1);
                elegirProcessed = true;
              }
            }
          }
        }

        // Replace cell references with their values (including cross-sheet and cross-instance refs)
        // Handle both simple (A1, C21) and absolute references ($A$1, $C$21)
        expression = expression.replace(
          /\$?([A-Za-z0-9]+:[A-Za-z0-9]+!|[A-Za-z0-9]+!)?\$?[A-Z]+\$?\d+/g,
          (match) => {
            const cleanMatch = match.replace(/\$/g, "");
            const cellValue = getCellValueFromAnySheet(
              cleanMatch,
              currentSheets,
            );
            if (typeof cellValue === "number") {
              return cellValue.toString();
            }
            return "0";
          },
        );

        // --- Logical functions: AND, OR, SI/IF (processed after cell refs are resolved) ---

        // Helper: evaluate a simple numeric/comparison expression
        const evalSimpleExpr = (expr: string): number | string => {
          try {
            const val = Function(`"use strict"; return (${expr})`)();
            if (typeof val === "boolean") return val ? 1 : 0;
            if (typeof val === "number" && !isNaN(val)) return val;
            return String(val);
          } catch {
            return expr;
          }
        };

        // AND(cond1, cond2, ...) → 1 if all truthy, else 0
        let andProcessed = true;
        while (andProcessed) {
          andProcessed = false;
          // Find innermost AND( first
          const andMatch = expression.match(/\bAND\(/i);
          if (andMatch && andMatch.index !== undefined) {
            const startIdx = andMatch.index;
            const openParen = startIdx + andMatch[0].length;
            const closeIdx = findClosingParen(expression, openParen);
            if (closeIdx !== -1) {
              const argsStr = expression.substring(openParen, closeIdx);
              const args = splitFunctionArgs(argsStr);
              const allTrue = args.every((arg) => {
                const v = evalSimpleExpr(arg);
                return typeof v === "number" ? v !== 0 : Boolean(v);
              });
              expression =
                expression.substring(0, startIdx) +
                (allTrue ? "1" : "0") +
                expression.substring(closeIdx + 1);
              andProcessed = true;
            }
          }
        }

        // OR / O(cond1, cond2, ...) → 1 if any truthy, else 0
        let orProcessed = true;
        while (orProcessed) {
          orProcessed = false;
          const orMatch = expression.match(/\b(?:OR|O)\(/i);
          if (orMatch && orMatch.index !== undefined) {
            const startIdx = orMatch.index;
            const openParen = startIdx + orMatch[0].length;
            const closeIdx = findClosingParen(expression, openParen);
            if (closeIdx !== -1) {
              const argsStr = expression.substring(openParen, closeIdx);
              const args = splitFunctionArgs(argsStr);
              const anyTrue = args.some((arg) => {
                const v = evalSimpleExpr(arg);
                return typeof v === "number" ? v !== 0 : Boolean(v);
              });
              expression =
                expression.substring(0, startIdx) +
                (anyTrue ? "1" : "0") +
                expression.substring(closeIdx + 1);
              orProcessed = true;
            }
          }
        }

        // SI / IF(condition, value_true, value_false) — process innermost first
        let siProcessed = true;
        while (siProcessed) {
          siProcessed = false;
          // Match innermost SI( or IF( (case-insensitive)
          const siMatch = expression.match(/\b(?:SI|IF)\(/i);
          if (siMatch && siMatch.index !== undefined) {
            const startIdx = siMatch.index;
            const openParen = startIdx + siMatch[0].length;
            const closeIdx = findClosingParen(expression, openParen);
            if (closeIdx !== -1) {
              const argsStr = expression.substring(openParen, closeIdx);
              const args = splitFunctionArgs(argsStr);
              if (args.length >= 2) {
                const conditionVal = evalSimpleExpr(args[0]);
                const isTruthy =
                  typeof conditionVal === "number"
                    ? conditionVal !== 0
                    : Boolean(conditionVal);
                let result: string;
                if (isTruthy) {
                  const v = evalSimpleExpr(args[1]);
                  result = String(v);
                } else {
                  if (args.length >= 3) {
                    const v = evalSimpleExpr(args[2]);
                    result = String(v);
                  } else {
                    result = "0";
                  }
                }
                expression =
                  expression.substring(0, startIdx) +
                  result +
                  expression.substring(closeIdx + 1);
                siProcessed = true;
              } else {
                expression =
                  expression.substring(0, startIdx) +
                  "#ERROR" +
                  expression.substring(closeIdx + 1);
                siProcessed = true;
              }
            }
          }
        }

        // Handle power operator (^) - convert to Math.pow
        expression = expression.replace(
          /(\d+(?:\.\d+)?|$$[^)]+$$)\s*\^\s*(\d+(?:\.\d+)?|$$[^)]+$$)/g,
          (_, base, exponent) => `Math.pow(${base}, ${exponent})`,
        );

        // Math functions - Spanish and English names → Math.* equivalents
        // Trigonometric (radians)
        expression = expression.replace(/\b(?:SENO|SIN)\(/gi, "Math.sin(");
        expression = expression.replace(/\b(?:COSENO|COS)\(/gi, "Math.cos(");
        expression = expression.replace(/\b(?:TANGENTE|TAN)\(/gi, "Math.tan(");
        expression = expression.replace(/\b(?:ASENO|ASIN)\(/gi, "Math.asin(");
        expression = expression.replace(/\b(?:ACOSENO|ACOS)\(/gi, "Math.acos(");
        expression = expression.replace(/\bATAN\(/gi, "Math.atan(");
        // Logarithmic
        expression = expression.replace(
          /\b(?:LOGARITMO|LOG)\(/gi,
          "Math.log10(",
        );
        expression = expression.replace(/\bLN\(/gi, "Math.log(");
        // Other math functions
        expression = expression.replace(/\b(?:RAIZ|SQRT)\(/gi, "Math.sqrt(");
        expression = expression.replace(/\bABS\(/gi, "Math.abs(");
        expression = expression.replace(
          /\b(?:POTENCIA|POWER)\(/gi,
          "Math.pow(",
        );
        expression = expression.replace(
          /\b(?:REDONDEAR|ROUND)\(([^,]+),\s*(\d+)\)/gi,
          (_, value, decimals) =>
            `(Math.round(${value} * Math.pow(10, ${decimals})) / Math.pow(10, ${decimals}))`,
        );
        expression = expression.replace(
          /\b(?:TECHO|CEILING)\(/gi,
          "Math.ceil(",
        );
        expression = expression.replace(/\b(?:PISO|FLOOR)\(/gi, "Math.floor(");
        expression = expression.replace(/\bPI\(\)/gi, "Math.PI");
        // Degrees ↔ Radians conversion
        expression = expression.replace(
          /\b(?:RADIANES|RADIANS)\(/gi,
          "(Math.PI/180)*(",
        );
        expression = expression.replace(
          /\b(?:GRADOS|DEGREES)\(/gi,
          "(180/Math.PI)*(",
        );

        // Check if expression is empty or invalid after processing
        if (!expression.trim() || expression.trim() === "()") {
          return "#ERROR";
        }

        // Basic math evaluation
        const result = Function(`"use strict"; return (${expression})`)();
        return typeof result === "number" && !isNaN(result) ? result : "#ERROR";
      } catch (error) {
        console.error("Error evaluating formula:", error);
        return "#ERROR";
      }
    },
    [customFunctions, evaluateCustomFunction, getCellValueFromAnySheet],
  );

  // Update sheets when sheetsInitialData changes (e.g., when designBase is set)
  useEffect(() => {
    // Only load once when sheetsInitialData first arrives
    if (
      sheetsInitialData &&
      sheetsInitialData.length > 0 &&
      !initialSheetsLoaded
    ) {
      // Normalize sheets to ensure all required properties exist
      // Convert arrays from DB back to Sets
      const normalizedSheets = sheetsInitialData.map((sheet) => ({
        ...sheet,
        templateHiddenRows: new Set(
          Array.isArray(sheet.templateHiddenRows)
            ? sheet.templateHiddenRows
            : sheet.templateHiddenRows instanceof Set
              ? sheet.templateHiddenRows
              : [],
        ),
        templateHiddenColumns: new Set(
          Array.isArray(sheet.templateHiddenColumns)
            ? sheet.templateHiddenColumns
            : sheet.templateHiddenColumns instanceof Set
              ? sheet.templateHiddenColumns
              : [],
        ),
        userHiddenRows: new Set(
          Array.isArray(sheet.userHiddenRows)
            ? sheet.userHiddenRows
            : sheet.userHiddenRows instanceof Set
              ? sheet.userHiddenRows
              : [],
        ),
        userHiddenColumns: new Set(
          Array.isArray(sheet.userHiddenColumns)
            ? sheet.userHiddenColumns
            : sheet.userHiddenColumns instanceof Set
              ? sheet.userHiddenColumns
              : [],
        ),
        hiddenCells: new Set(
          Array.isArray(sheet.hiddenCells)
            ? sheet.hiddenCells
            : sheet.hiddenCells instanceof Set
              ? sheet.hiddenCells
              : [],
        ),
        freezeRow: sheet.freezeRow || 0,
        freezeColumn: sheet.freezeColumn || 0,
        mergedCells: sheet.mergedCells || [],
      }));

      // Set the initial sheets data
      setSheets(normalizedSheets);
      setInitialSheetsLoaded(true);

      // Set active sheet to the first sheet in the new data
      if (normalizedSheets[0]?.id) {
        setActiveSheetId(normalizedSheets[0].id);
        setSelectedCell("A1");
        selectionAnchorRef.current = "A1";
        setSelectedCells(new Set(["A1"]));
        setFormulaInput("");
      }

      // Recalculate all formulas for all sheets after a short delay
      const recalculateAllSheetsFormulas = async () => {
        const updatedSheets: Sheet[] = [];

        for (const sheet of normalizedSheets) {
          const newCells = { ...sheet.cells };
          const updatedComputedValues: Record<string, string | number> = {};

          // Process all cells to recalculate formulas
          for (const ref of Object.keys(newCells)) {
            try {
              const result = await evaluateFormula(
                newCells[ref].formula,
                newCells,
                normalizedSheets,
              );
              updatedComputedValues[ref] = result !== undefined ? result : "";

              // Update the cell grid with the new computed value for next cell calculations
              newCells[ref] = {
                ...newCells[ref],
                computed: updatedComputedValues[ref],
              };
            } catch (error) {
              console.error(`Error calculating cell ${ref}:`, error);
              updatedComputedValues[ref] = "#ERROR";
              newCells[ref] = {
                ...newCells[ref],
                computed: "#ERROR",
              };
            }
          }

          updatedSheets.push({ ...sheet, cells: newCells });
        }

        // Update all sheets with recalculated formulas
        setSheets(updatedSheets);
      };

      // Run the recalculation after a short delay to ensure the component is properly mounted
      setTimeout(() => {
        recalculateAllSheetsFormulas();
      }, 100);
    }
  }, [sheetsInitialData, evaluateFormula, initialSheetsLoaded]);

  // Helper function to find all cells that reference a given cell
  const findDependentCells = useCallback(
    (targetCell: string, cells: CellGrid): string[] => {
      const dependents: string[] = [];

      Object.keys(cells).forEach((cellRef) => {
        const cell = cells[cellRef];
        if (cell?.formula && cell.formula.startsWith("=")) {
          // Check if this cell's formula references the target cell
          const cellRefRegex = new RegExp(`\\b${targetCell}\\b`, "g");
          if (cellRefRegex.test(cell.formula)) {
            dependents.push(cellRef);
          }
        }
      });

      return dependents;
    },
    [],
  );

  // Helper function to get all cells that need to be recalculated (including nested dependencies)
  const getDependencyChain = useCallback(
    (changedCell: string, cells: CellGrid): string[] => {
      const toRecalculate = new Set<string>();
      const queue = [changedCell];
      const processed = new Set<string>();

      while (queue.length > 0) {
        const currentCell = queue.shift()!;
        if (processed.has(currentCell)) continue;

        processed.add(currentCell);
        toRecalculate.add(currentCell);

        // Find cells that depend on the current cell
        const dependents = findDependentCells(currentCell, cells);
        dependents.forEach((dependent) => {
          if (!processed.has(dependent)) {
            queue.push(dependent);
          }
        });
      }

      return Array.from(toRecalculate);
    },
    [findDependentCells],
  );

  // Update cell value in current sheet (optimized for typing performance)
  const updateCell = useCallback(
    async (
      cellRef: string,
      value: string,
      options?: { skipHistory?: boolean; immediate?: boolean },
    ) => {
      // For typing, use debounced history; for other actions, save immediately
      if (!options?.skipHistory) {
        if (options?.immediate) {
          saveToHistoryImmediate();
        } else {
          saveToHistoryDebounced();
        }
      }

      // Fast path: if value doesn't start with '=', it's not a formula
      const isFormula = value.trim().startsWith("=");

      // Get current state
      setSheets((prevSheets) => {
        const currentSheet = prevSheets.find(
          (sheet) => sheet.id === activeSheetId,
        );
        if (!currentSheet) return prevSheets;

        const newCells = { ...currentSheet.cells };

        // Parse the value to number if it's numeric, otherwise keep as string
        const numValue = Number(value);
        const computedValue = isFormula
          ? value
          : !isNaN(numValue) && value.trim() !== ""
            ? numValue
            : value;

        // Create or update the cell with new value
        newCells[cellRef] = {
          ...newCells[cellRef],
          value: value,
          formula: value,
          computed: computedValue,
        };

        // Only evaluate formulas if this is actually a formula
        if (isFormula) {
          // Get all cells that need to be recalculated
          const cellsToRecalculate = getDependencyChain(cellRef, newCells);

          // Sort cells: process the changed cell first, then dependents
          const sortedCells = [
            cellRef,
            ...cellsToRecalculate.filter((ref) => ref !== cellRef),
          ];

          // Schedule async recalculation without blocking the initial update
          Promise.resolve().then(async () => {
            const updatedComputedValues: Record<string, string | number> = {};

            // Process each cell that needs recalculation
            for (const ref of sortedCells) {
              const cellToCalc = newCells[ref];
              if (!cellToCalc) continue;

              try {
                const result = await evaluateFormula(
                  cellToCalc.formula,
                  newCells,
                  prevSheets,
                );
                updatedComputedValues[ref] = result !== undefined ? result : "";

                // Update the temp cell grid with the new computed value for next cell calculations
                newCells[ref] = {
                  ...newCells[ref],
                  computed: updatedComputedValues[ref],
                };
              } catch (error) {
                console.error(`Error calculating cell ${ref}:`, error);
                updatedComputedValues[ref] = "#ERROR";
                newCells[ref] = {
                  ...newCells[ref],
                  computed: "#ERROR",
                };
              }
            }

            // Apply all the computed values at once in a single state update
            setSheets((latestSheets) =>
              latestSheets.map((sheet) => {
                if (sheet.id === activeSheetId) {
                  const updatedCellsWithComputed = { ...sheet.cells };

                  // Update computed values only for cells that were recalculated
                  Object.keys(updatedComputedValues).forEach((ref) => {
                    if (updatedCellsWithComputed[ref]) {
                      updatedCellsWithComputed[ref] = {
                        ...updatedCellsWithComputed[ref],
                        computed: updatedComputedValues[ref],
                      };
                    }
                  });

                  return { ...sheet, cells: updatedCellsWithComputed };
                }
                return sheet;
              }),
            );
          });
        }

        // Return updated sheets with new cell values (computed values will be updated asynchronously for formulas)
        return prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            return { ...sheet, cells: newCells };
          }
          return sheet;
        });
      });
    },
    [
      evaluateFormula,
      activeSheetId,
      getDependencyChain,
      saveToHistoryDebounced,
      saveToHistoryImmediate,
    ],
  );

  // Handler for updating dropdown cell values
  const handleDropdownCellChange = useCallback(
    async (cellRef: string, value: string) => {
      // Save current state to history before making changes (immediate for dropdown)
      saveToHistoryImmediate();

      // Update the cell value while preserving options and other properties
      setSheets((prevSheets) => {
        const currentSheet = prevSheets.find(
          (sheet) => sheet.id === activeSheetId,
        );
        if (!currentSheet) return prevSheets;

        const newCells = { ...currentSheet.cells };
        const existingCell = newCells[cellRef];

        // Preserve existing cell properties including options
        newCells[cellRef] = {
          ...existingCell,
          value: value,
          formula: value,
          computed: value,
        };

        // Get cells to recalculate
        const cellsToRecalculate = getDependencyChain(cellRef, newCells);

        // Schedule async recalculation without blocking
        Promise.resolve().then(async () => {
          const updatedComputedValues: Record<string, string | number> = {};

          for (const ref of cellsToRecalculate) {
            const cellToCalc = newCells[ref];
            if (!cellToCalc) continue;

            try {
              const result = await evaluateFormula(
                cellToCalc.formula,
                newCells,
                prevSheets,
              );
              updatedComputedValues[ref] = result !== undefined ? result : "";
              newCells[ref] = {
                ...newCells[ref],
                computed: updatedComputedValues[ref],
              };
            } catch (error) {
              console.error(`Error calculating cell ${ref}:`, error);
              updatedComputedValues[ref] = "#ERROR";
              newCells[ref] = {
                ...newCells[ref],
                computed: "#ERROR",
              };
            }
          }

          // Apply all the computed values at once in a single state update
          setSheets((latestSheets) =>
            latestSheets.map((sheet) => {
              if (sheet.id === activeSheetId) {
                const updatedCellsWithComputed = { ...sheet.cells };
                Object.keys(updatedComputedValues).forEach((ref) => {
                  if (updatedCellsWithComputed[ref]) {
                    updatedCellsWithComputed[ref] = {
                      ...updatedCellsWithComputed[ref],
                      computed: updatedComputedValues[ref],
                    };
                  }
                });
                return { ...sheet, cells: updatedCellsWithComputed };
              }
              return sheet;
            }),
          );
        });

        return prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            return { ...sheet, cells: newCells };
          }
          return sheet;
        });
      });
    },
    [
      evaluateFormula,
      activeSheetId,
      getDependencyChain,
      saveToHistoryImmediate,
    ],
  );

  // Insert text at cursor position
  const insertAtCursor = (textToInsert: string) => {
    const currentPosition = formulaCursorPosition;
    const newFormula =
      formulaInput.slice(0, currentPosition) +
      textToInsert +
      formulaInput.slice(currentPosition);

    setFormulaInput(newFormula);
    // Also update inline cell value if in inline editing mode
    if (editingCell === selectedCell) {
      setInlineCellValue(newFormula);
    }
    updateCell(selectedCell, newFormula);

    // Set cursor position after the inserted text
    const newPosition = currentPosition + textToInsert.length;
    setTimeout(() => {
      setCursorPosition(newPosition);
    }, 0);
  };

  // Insert function into formula
  const insertFunction = (func: CustomFunction) => {
    const functionCall = `${func.code}(${func.variables.join(", ")})`;
    insertAtCursor(functionCall);
    setShowFunctionLibrary(false);
  };

  // Handle copy
  const handleCopy = useCallback(async () => {
    if (selectedCells.size === 0) return;

    const cellData = new Map<
      string,
      {
        value: string;
        formula: string;
        computed: string | number | undefined;
        bold?: boolean;
        textColor?: string;
        backgroundColor?: string;
        border?: string;
      }
    >();

    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;

    // Collect all selected cell data and find the bounding box
    selectedCells.forEach((cellRef) => {
      const pos = parseCellRef(cellRef);
      if (pos) {
        minRow = Math.min(minRow, pos.row);
        maxRow = Math.max(maxRow, pos.row);
        minCol = Math.min(minCol, pos.col);
        maxCol = Math.max(maxCol, pos.col);

        const cell = cells[cellRef];
        cellData.set(cellRef, {
          value: cell?.value || "",
          formula: cell?.formula || "",
          computed: cell?.computed,
          bold: cell?.bold,
          textColor: cell?.textColor,
          backgroundColor: cell?.backgroundColor,
          border: cell?.border,
        });
      }
    });

    setCopiedCells(cellData);
    setCopiedRange({ minRow, maxRow, minCol, maxCol });

    // Copy to system clipboard in TSV format (Tab-Separated Values)
    // This allows pasting to external applications like Excel, Google Sheets, Notes, etc.
    try {
      const rows: string[][] = [];
      for (let r = minRow; r <= maxRow; r++) {
        const row: string[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          const cellRef = getCellRef(r, c);
          const cell = cells[cellRef];
          // Use computed value for display, or value if no computation
          const cellValue =
            cell?.computed !== undefined
              ? String(cell.computed)
              : cell?.value || "";
          row.push(cellValue);
        }
        rows.push(row);
      }

      // Convert to TSV format (tabs separate columns, newlines separate rows)
      const tsvData = rows.map((row) => row.join("\t")).join("\n");

      // Write to clipboard
      await navigator.clipboard.writeText(tsvData);
      console.log(`Copied ${cellData.size} cell(s) to clipboard`);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      // Fallback: still works for internal copy/paste even if clipboard API fails
    }
  }, [selectedCells, cells]);

  // Handle paste
  const handlePaste = useCallback(async () => {
    // Save current state to history before pasting (immediate for paste)
    saveToHistoryImmediate();

    const targetPos = parseCellRef(selectedCell);
    if (!targetPos) return;

    // Try to read from system clipboard first (for external paste)
    let clipboardData: string | null = null;
    try {
      clipboardData = await navigator.clipboard.readText();
    } catch (error) {
      console.log("Could not read from clipboard, using internal copy data");
    }

    // If we have clipboard data, parse it (external paste)
    if (clipboardData && clipboardData.trim()) {
      // Parse TSV data (Tab-Separated Values)
      const rows = clipboardData.split("\n").filter((row) => row.trim() !== "");
      const newCellsData: Array<{ cellRef: string; value: string }> = [];

      rows.forEach((row, rowIndex) => {
        const columns = row.split("\t");
        columns.forEach((value, colIndex) => {
          const targetRow = targetPos.row + rowIndex;
          const targetCol = targetPos.col + colIndex;

          // Check bounds
          if (
            targetRow >= 0 &&
            targetRow < ROWS &&
            targetCol >= 0 &&
            targetCol < COLS
          ) {
            const targetCellRef = getCellRef(targetRow, targetCol);
            newCellsData.push({
              cellRef: targetCellRef,
              value: value.trim(),
            });
          }
        });
      });

      // Apply external paste data
      setSheets((prevSheets) => {
        return prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;

          const updatedCells = { ...sheet.cells };

          // Update all target cells with pasted values
          newCellsData.forEach(({ cellRef, value }) => {
            updatedCells[cellRef] = {
              ...updatedCells[cellRef],
              value: value,
              formula: value,
              computed: value,
            };
          });

          return {
            ...sheet,
            cells: updatedCells,
          };
        });
      });

      // Recalculate formulas after paste
      setTimeout(async () => {
        setSheets((prevSheets) => {
          return prevSheets.map((sheet) => {
            if (sheet.id !== activeSheetId) return sheet;

            const updatedCells = { ...sheet.cells };

            Promise.all(
              newCellsData.map(async ({ cellRef }) => {
                const cell = updatedCells[cellRef];
                if (cell) {
                  const computed = await evaluateFormula(
                    cell.formula,
                    updatedCells,
                    prevSheets,
                  );
                  updatedCells[cellRef] = {
                    ...cell,
                    computed: computed ?? "",
                  };
                }
              }),
            );

            return {
              ...sheet,
              cells: updatedCells,
            };
          });
        });

        // Recalculate dependent cells
        for (const { cellRef } of newCellsData) {
          const dependencyChain = getDependencyChain(cellRef, cells);
          for (const depCell of dependencyChain) {
            if (depCell !== cellRef) {
              await updateCell(depCell, cells[depCell]?.formula || "");
            }
          }
        }
      }, 50);

      console.log(`Pasted ${newCellsData.length} cell(s) from clipboard`);
      return;
    }

    // Fallback to internal paste (with formula adjustment)
    if (copiedCells.size === 0 || !copiedRange) return;

    const rowOffset = targetPos.row - copiedRange.minRow;
    const colOffset = targetPos.col - copiedRange.minCol;

    // Build new cells data
    const newCellsData: Array<{ cellRef: string; value: string; style: any }> =
      [];

    copiedCells.forEach((cellData, sourceCellRef) => {
      const sourcePos = parseCellRef(sourceCellRef);
      if (!sourcePos) return;

      const targetRow = sourcePos.row + rowOffset;
      const targetCol = sourcePos.col + colOffset;

      // Check bounds
      if (
        targetRow < 0 ||
        targetRow >= ROWS ||
        targetCol < 0 ||
        targetCol >= COLS
      ) {
        return;
      }

      const targetCellRef = getCellRef(targetRow, targetCol);

      // Adjust formula references if it's a formula
      let newFormula = cellData.formula;
      if (newFormula.startsWith("=")) {
        // Adjust relative cell references in the formula
        newFormula = newFormula.replace(
          /((?:[A-Za-z0-9]+:[A-Za-z0-9]+!|[A-Za-z0-9]+!)?[A-Z]+\d+)/g,
          (match) => {
            // Check if it's an absolute reference (with $)
            if (match.includes("$")) {
              return match; // Don't adjust absolute references
            }

            // Handle cross-sheet references
            if (match.includes("!")) {
              const [sheetPart, cellPart] = match.split("!");
              const refPos = parseCellRef(cellPart);
              if (refPos) {
                const newRow = refPos.row + rowOffset;
                const newCol = refPos.col + colOffset;
                if (
                  newRow >= 0 &&
                  newRow < ROWS &&
                  newCol >= 0 &&
                  newCol < COLS
                ) {
                  return `${sheetPart}!${getCellRef(newRow, newCol)}`;
                }
              }
              return match;
            }

            // Regular cell reference
            const refPos = parseCellRef(match);
            if (refPos) {
              const newRow = refPos.row + rowOffset;
              const newCol = refPos.col + colOffset;
              if (
                newRow >= 0 &&
                newRow < ROWS &&
                newCol >= 0 &&
                newCol < COLS
              ) {
                return getCellRef(newRow, newCol);
              }
            }
            return match;
          },
        );
      }

      newCellsData.push({
        cellRef: targetCellRef,
        value: newFormula,
        style: {
          bold: cellData.bold,
          textColor: cellData.textColor,
          backgroundColor: cellData.backgroundColor,
          border: cellData.border,
        },
      });
    });

    // Apply all changes at once
    setSheets((prevSheets) => {
      return prevSheets.map((sheet) => {
        if (sheet.id !== activeSheetId) return sheet;

        const updatedCells = { ...sheet.cells };

        // Update all target cells
        newCellsData.forEach(({ cellRef, value, style }) => {
          updatedCells[cellRef] = {
            value: value,
            formula: value,
            computed: value,
            ...style,
          };
        });

        return {
          ...sheet,
          cells: updatedCells,
        };
      });
    });

    // Recalculate formulas after paste
    setTimeout(async () => {
      setSheets((prevSheets) => {
        return prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;

          const updatedCells = { ...sheet.cells };

          Promise.all(
            newCellsData.map(async ({ cellRef }) => {
              const cell = updatedCells[cellRef];
              if (cell) {
                const computed = await evaluateFormula(
                  cell.formula,
                  updatedCells,
                  prevSheets,
                );
                updatedCells[cellRef] = {
                  ...cell,
                  computed: computed ?? "",
                };
              }
            }),
          );

          return {
            ...sheet,
            cells: updatedCells,
          };
        });
      });

      // Recalculate dependent cells
      for (const { cellRef } of newCellsData) {
        const dependencyChain = getDependencyChain(cellRef, cells);
        for (const depCell of dependencyChain) {
          if (depCell !== cellRef) {
            await updateCell(depCell, cells[depCell]?.formula || "");
          }
        }
      }
    }, 50);

    console.log(
      `Pasted ${newCellsData.length} cell(s) with formula adjustment`,
    );
  }, [
    copiedCells,
    copiedRange,
    selectedCell,
    activeSheetId,
    cells,
    evaluateFormula,
    getDependencyChain,
    updateCell,
    saveToHistoryImmediate,
  ]);

  // Handle global keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if any input, textarea, or select element is focused
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT" ||
          (activeElement as HTMLElement).contentEditable === "true");

      // Only handle navigation when formula input is not focused and no other inputs are focused
      if (
        !isFormulaInputFocused &&
        !isAddingToFormula &&
        !editingSheetName &&
        !showFunctionLibrary &&
        !showTemplateLibrary &&
        !isInputFocused
      ) {
        switch (e.key) {
          case "ArrowUp":
            e.preventDefault();
            navigateCell("up");
            break;
          case "ArrowDown":
            e.preventDefault();
            navigateCell("down");
            break;
          case "ArrowLeft":
            e.preventDefault();
            navigateCell("left");
            break;
          case "ArrowRight":
            e.preventDefault();
            navigateCell("right");
            break;
          case "Enter":
            e.preventDefault();
            navigateCell("down");
            break;
          case "Tab":
            e.preventDefault();
            navigateCell("right");
            break;
          case "F2":
            e.preventDefault();
            // Start inline editing mode
            handleStartInlineEditing(selectedCell);
            break;
          case "Delete":
          case "Backspace":
            e.preventDefault();
            // Clear cell content
            setFormulaInput("");
            updateCell(selectedCell, "");
            break;
          default:
            // Handle copy (Ctrl+C or Cmd+C)
            if ((e.ctrlKey || e.metaKey) && e.key === "c") {
              e.preventDefault();
              handleCopy();
              break;
            }
            // Handle paste (Ctrl+V or Cmd+V)
            if ((e.ctrlKey || e.metaKey) && e.key === "v") {
              e.preventDefault();
              handlePaste();
              break;
            }
            // Handle undo (Ctrl+Z or Cmd+Z)
            if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
              e.preventDefault();
              handleUndo();
              break;
            }
            // Handle redo (Ctrl+Y or Cmd+Shift+Z)
            if (
              (e.ctrlKey && e.key === "y") ||
              (e.metaKey && e.shiftKey && e.key === "z")
            ) {
              e.preventDefault();
              handleRedo();
              break;
            }
            // If user types a regular character, start inline editing
            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
              e.preventDefault();
              // Start inline editing mode
              setEditingCell(selectedCell);
              setInlineCellValue(e.key);
              setFormulaInput(e.key);
              formulaInputValueRef.current = e.key;
              // Enable formula building mode if starting with "="
              if (e.key === "=") {
                setIsFormulaBuildingMode(true);
              }
            }
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedCell,
    isFormulaInputFocused,
    isAddingToFormula,
    formulaInput,
    editingSheetName,
    showFunctionLibrary,
    showTemplateLibrary,
    navigateCell,
    handleCopy,
    handlePaste,
    handleUndo,
    handleRedo,
    updateCell,
  ]);

  // Handle cell click
  const handleCellClick = (cellRef: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Check for multi-select modifiers (only in normal mode, not formula building)
    if (!isFormulaBuildingMode && event) {
      if (event.shiftKey) {
        // Range selection - use anchor as start, clicked cell as end
        const startCell = selectionAnchorRef.current;
        setSelectedCell(cellRef);
        // Don't update anchor - keep the original anchor for next shift+click
        selectCellRange(startCell, cellRef);
        return;
      } else if (event.ctrlKey || event.metaKey) {
        // Toggle selection
        setSelectedCell(cellRef);
        selectionAnchorRef.current = cellRef; // Update anchor for ctrl+click
        setSelectedCells((prev) => {
          const next = new Set(prev);
          if (next.has(cellRef)) {
            next.delete(cellRef);
          } else {
            next.add(cellRef);
          }
          return next.size > 0 ? next : new Set([cellRef]);
        });
        return;
      }
    }

    if (isFormulaBuildingMode && isAddingToFormula) {
      // Adding cell reference to formula - DON'T change selected cell
      if (rangeSelectionStart && rangeSelectionStart !== cellRef) {
        // Complete range selection
        const rangeRef = `${rangeSelectionStart}:${cellRef}`;
        insertAtCursor(rangeRef);
        setRangeSelectionStart(null);
        setIsAddingToFormula(false);
      } else {
        // Build cross-tab reference based on selected target instance and sheet
        let crossTabRef = cellRef;

        // Check if we're referencing a different instance or sheet
        if (targetInstanceId !== instanceId) {
          // Cross-instance reference: design:Sheet1!A1
          const targetInstance = allSheets.find(
            (inst) => inst.instanceId === targetInstanceId,
          );
          const targetSheet = targetInstance?.sheets.find(
            (s) => s.id === targetSheetId,
          );
          if (targetSheet) {
            crossTabRef = `${targetInstanceId}:${targetSheet.name}!${cellRef}`;
          }
        } else if (targetSheetId !== activeSheetId) {
          // Same instance, different sheet: Sheet1!A1
          const targetSheet = sheets.find((s) => s.id === targetSheetId);
          if (targetSheet) {
            crossTabRef = `${targetSheet.name}!${cellRef}`;
          }
        }
        // else: same instance and sheet, just use cellRef (e.g., A1)

        insertAtCursor(crossTabRef);
        setIsAddingToFormula(false);
      }

      // Keep focus on formula input and don't change selected cell
      setTimeout(() => {
        if (formulaInputRef.current) {
          formulaInputRef.current.focus();
        }
      }, 0);
    } else {
      // Normal cell selection - use single select
      selectSingleCell(cellRef);
    }
  };

  // Handle starting inline editing
  const handleStartInlineEditing = useCallback(
    (cellRef: string) => {
      const cell = cells[cellRef];
      const cellFormula = cell?.formula || "";
      setEditingCell(cellRef);
      setInlineCellValue(cellFormula);
      setFormulaInput(cellFormula);
      formulaInputValueRef.current = cellFormula;
      // Enable formula building mode if the cell contains a formula
      const isFormula = cellFormula.startsWith("=");
      setIsFormulaBuildingMode(isFormula);
    },
    [cells],
  );

  // Handle stopping inline editing
  const handleStopInlineEditing = useCallback(
    (value: string) => {
      if (editingCell) {
        // Only update if value has changed
        const currentCell = cells[editingCell];
        const currentValue = currentCell?.formula || currentCell?.value || "";
        if (value !== currentValue) {
          updateCell(editingCell, value);
        }
        setEditingCell(null);
        // Sync the formula input with the final value
        setFormulaInput(value);
        formulaInputValueRef.current = value;
      }
    },
    [editingCell, updateCell, cells],
  );

  // Handle navigation after editing
  const handleNavigateAfterEdit = useCallback(
    (direction: "down" | "right") => {
      navigateCell(direction);
    },
    [navigateCell],
  );

  // Handle formula input change (optimized for typing performance)
  const handleFormulaChange = useCallback(
    (value: string) => {
      // Store in ref for immediate access without re-renders
      formulaInputValueRef.current = value;

      // Batch state updates to minimize re-renders
      const isFormula = value.startsWith("=");

      // Use startTransition for non-urgent formula input updates
      startTransition(() => {
        setFormulaInput(value);
        updateCursorPosition();

        if (isFormula !== isFormulaBuildingMode) {
          setIsFormulaBuildingMode(isFormula);
        }

        if (!isFormula) {
          setRangeSelectionStart(null);
          setIsAddingToFormula(false);
        }
      });

      // Don't update cell on every keystroke - only on Enter or blur
    },
    [isFormulaBuildingMode, updateCursorPosition],
  );

  // Toggle adding to formula mode
  const toggleAddingToFormula = () => {
    updateCursorPosition(); // Make sure we have the latest cursor position
    const newAddingState = !isAddingToFormula;
    setIsAddingToFormula(newAddingState);
    setRangeSelectionStart(null);

    // Reset to current instance and sheet when enabling
    if (newAddingState) {
      setTargetInstanceId(instanceId);
      setTargetSheetId(activeSheetId);
    }
  };

  // Handle target instance change in cross-tab selector
  const handleTargetInstanceChange = (newInstanceId: string) => {
    setTargetInstanceId(newInstanceId);
    // When changing instance, set the first sheet of that instance as target
    const targetInstance = allSheets.find(
      (inst) => inst.instanceId === newInstanceId,
    );
    if (targetInstance && targetInstance.sheets.length > 0) {
      setTargetSheetId(targetInstance.sheets[0].id);
    }
  };

  // Handle target sheet change in cross-tab selector
  const handleTargetSheetChange = (newSheetId: string) => {
    setTargetSheetId(newSheetId);
  };

  // Handle range selection
  const handleRangeSelection = () => {
    updateCursorPosition(); // Make sure we have the latest cursor position
    if (rangeSelectionStart) {
      setRangeSelectionStart(null);
    } else {
      setRangeSelectionStart(selectedCell);
      setIsAddingToFormula(true);
    }
  };

  // Exit formula building mode
  const exitFormulaBuildingMode = () => {
    setIsFormulaBuildingMode(false);
    setRangeSelectionStart(null);
    setIsAddingToFormula(false);
    updateCell(selectedCell, formulaInput);
  };

  // Handle key press in formula input
  const handleFormulaKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      formulaInputRef.current?.blur();
      exitFormulaBuildingMode();
      navigateCell("down"); // Move to next row after Enter
    } else if (e.key === "Escape") {
      e.preventDefault();
      formulaInputRef.current?.blur();
      exitFormulaBuildingMode();
    } else if (e.key === "Tab") {
      e.preventDefault();
      exitFormulaBuildingMode();
      navigateCell("right"); // Move to next column after Tab
    }
  };

  // Add new sheet
  const addNewSheet = () => {
    const newSheetNumber = sheets.length + 1;
    const newSheet: Sheet = {
      id: `${instanceId}-sheet${Date.now()}`,
      name: `Hoja${newSheetNumber}`,
      cells: {},
      columnWidths: {},
      rowHeights: {},
      templateHiddenRows: new Set<number>(),
      templateHiddenColumns: new Set<number>(),
      userHiddenRows: new Set<number>(),
      userHiddenColumns: new Set<number>(),
      hiddenCells: new Set<string>(),
      freezeRow: 0,
      freezeColumn: 0,
      mergedCells: [],
    };

    // If there's exactly one template, load it into the new sheet
    if (templates.length === 1) {
      const template = templates[0];
      newSheet.cells = { ...(template.cells || {}) };
      newSheet.columnWidths = { ...(template.cellsStyles?.columnWidths || {}) };
      newSheet.rowHeights = { ...(template.cellsStyles?.rowHeights || {}) };
    }

    setSheets((prev) => [...prev, newSheet]);
    setActiveSheetId(newSheet.id);
    setSelectedCell("A1");
    selectionAnchorRef.current = "A1";
    setSelectedCells(new Set(["A1"]));
    setFormulaInput("");

    // If template was loaded, recalculate formulas for the new sheet
    if (templates.length === 1) {
      setTimeout(() => {
        const recalculateNewSheetFormulas = async () => {
          setSheets((latestSheets) => {
            const template = templates[0];
            const newCells = { ...template.cells };
            const updatedComputedValues: Record<string, string | number> = {};

            // Process all cells to recalculate formulas
            (async () => {
              for (const ref of Object.keys(newCells)) {
                try {
                  const result = await evaluateFormula(
                    newCells[ref].formula,
                    newCells,
                    latestSheets,
                  );
                  updatedComputedValues[ref] =
                    result !== undefined ? result : "";

                  // Update the cell grid with the new computed value for next cell calculations
                  newCells[ref] = {
                    ...newCells[ref],
                    computed: updatedComputedValues[ref],
                  };
                } catch (error) {
                  console.error(`Error calculating cell ${ref}:`, error);
                  updatedComputedValues[ref] = "#ERROR";
                  newCells[ref] = {
                    ...newCells[ref],
                    computed: "#ERROR",
                  };
                }
              }

              // Apply all the computed values at once
              setSheets((currentSheets) =>
                currentSheets.map((sheet) => {
                  if (sheet.id === newSheet.id) {
                    const updatedCellsWithComputed = { ...sheet.cells };

                    // Update computed values for all cells
                    Object.keys(updatedComputedValues).forEach((ref) => {
                      if (updatedCellsWithComputed[ref]) {
                        updatedCellsWithComputed[ref] = {
                          ...updatedCellsWithComputed[ref],
                          computed: updatedComputedValues[ref],
                        };
                      }
                    });

                    return { ...sheet, cells: updatedCellsWithComputed };
                  }
                  return sheet;
                }),
              );
            })();

            return latestSheets;
          });
        };

        recalculateNewSheetFormulas();
      }, 0);
    }
  };

  // Switch to sheet
  const switchToSheet = (sheetId: string) => {
    setActiveSheetId(sheetId);

    // If not in formula building mode, reset selection
    if (!isFormulaBuildingMode) {
      setSelectedCell("A1");
      selectionAnchorRef.current = "A1";
      setSelectedCells(new Set(["A1"]));
      setFormulaInput("");
      setIsAddingToFormula(false);
      setRangeSelectionStart(null);
    }
    // If in formula building mode, keep the formula and selection state
    // so users can navigate to other sheets to select cells
  };

  // Delete sheet
  const deleteSheet = (sheetId: string) => {
    if (sheets.length <= 1) return; // Don't delete the last sheet

    setSheets((prev) => prev.filter((sheet) => sheet.id !== sheetId));

    // If we deleted the active sheet, switch to the first remaining sheet
    if (activeSheetId === sheetId) {
      const remainingSheets = sheets.filter((sheet) => sheet.id !== sheetId);
      if (remainingSheets.length > 0) {
        switchToSheet(remainingSheets[0].id);
      }
    }
  };

  // Rename sheet
  const renameSheet = (sheetId: string, newName: string) => {
    setSheets((prev) =>
      prev.map((sheet) =>
        sheet.id === sheetId ? { ...sheet, name: newName } : sheet,
      ),
    );
    setEditingSheetName(null);
  };

  // Handle sheet name edit
  const handleSheetNameKeyPress = (e: React.KeyboardEvent, sheetId: string) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLInputElement;
      renameSheet(sheetId, target.value);
    } else if (e.key === "Escape") {
      setEditingSheetName(null);
    }
  };

  // Load template into current sheet(s)
  const loadTemplate = useCallback(
    (template: Template) => {
      // Check if template has multiple sheets or single sheet format
      if (template.sheets && template.sheets.length > 0) {
        // Multi-sheet template: Replace all sheets
        const newSheets = template.sheets.map((templateSheet, index) => {
          const sheetId = `${instanceId}-sheet${index + 1}`;

          // Process template cells to populate with element values if elementKey exists
          const processedCells = { ...templateSheet.cells };

          Object.keys(processedCells).forEach((cellRef) => {
            const cell = processedCells[cellRef];

            // Check if cell has elementKey property
            if (cell.elementKey) {
              // Search for matching key in element.values
              const elementValue = element.values.find(
                (val: any) => val.key === cell.elementKey,
              );

              // If found, override cell value with element value
              if (elementValue && elementValue.value !== undefined) {
                // Convert to number if the type is number, otherwise keep as string
                let computedValue: string | number = String(elementValue.value);

                if (elementValue.type === "number") {
                  const numValue = Number(elementValue.value);
                  if (!isNaN(numValue)) {
                    computedValue = numValue;
                  }
                }

                processedCells[cellRef] = {
                  ...cell,
                  value: String(elementValue.value),
                  formula: String(elementValue.value),
                  computed: computedValue,
                };
              }
            }
          });

          return {
            id: sheetId,
            name: templateSheet.name,
            cells: processedCells,
            columnWidths: { ...templateSheet.cellsStyles.columnWidths },
            rowHeights: { ...templateSheet.cellsStyles.rowHeights },
            templateHiddenRows: new Set<number>(
              templateSheet.cellsStyles.hiddenRows || [],
            ),
            templateHiddenColumns: new Set<number>(
              templateSheet.cellsStyles.hiddenColumns || [],
            ),
            userHiddenRows: new Set<number>(),
            userHiddenColumns: new Set<number>(),
            hiddenCells: new Set<string>(),
            freezeRow: templateSheet.cellsStyles.freezeRow || 0,
            freezeColumn: templateSheet.cellsStyles.freezeColumn || 0,
            mergedCells: templateSheet.cellsStyles.mergedCells || [],
          };
        });

        // Recalculate all formulas for all sheets
        const recalculateAllSheetsFormulas = async () => {
          const updatedSheets: Sheet[] = [];

          for (const sheet of newSheets) {
            const newCells = { ...sheet.cells };
            const updatedComputedValues: Record<string, string | number> = {};

            // Process all cells to recalculate formulas
            for (const ref of Object.keys(newCells)) {
              try {
                const result = await evaluateFormula(
                  newCells[ref].formula,
                  newCells,
                  newSheets,
                );
                updatedComputedValues[ref] = result !== undefined ? result : "";

                // Update the cell grid with the new computed value for next cell calculations
                newCells[ref] = {
                  ...newCells[ref],
                  computed: updatedComputedValues[ref],
                };
              } catch (error) {
                console.error(`Error calculating cell ${ref}:`, error);
                updatedComputedValues[ref] = "#ERROR";
                newCells[ref] = {
                  ...newCells[ref],
                  computed: "#ERROR",
                };
              }
            }

            updatedSheets.push({ ...sheet, cells: newCells });
          }

          // Update all sheets with recalculated formulas
          setSheets(updatedSheets);

          // Set active sheet to the first sheet
          if (updatedSheets[0]?.id) {
            setActiveSheetId(updatedSheets[0].id);
          }
        };

        // Run the recalculation immediately after loading template
        recalculateAllSheetsFormulas();

        setSheets(newSheets);
        setShowTemplateLibrary(false);
        setSelectedCell("A1");
        selectionAnchorRef.current = "A1";
        setSelectedCells(new Set(["A1"]));
        setFormulaInput("");
        return;
      }

      // Legacy single-sheet template: Update only the current sheet
      setSheets((prevSheets) => {
        const updatedSheets = prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            // Process template cells to populate with element values if elementKey exists
            const processedCells = { ...(template.cells || {}) };

            Object.keys(processedCells).forEach((cellRef) => {
              const cell = processedCells[cellRef];

              // Check if cell has elementKey property
              if (cell.elementKey) {
                // Search for matching key in element.values
                const elementValue = element.values.find(
                  (val: any) => val.key === cell.elementKey,
                );

                // If found, override cell value with element value
                if (elementValue && elementValue.value !== undefined) {
                  // Convert to number if the type is number, otherwise keep as string
                  let computedValue: string | number = String(
                    elementValue.value,
                  );

                  if (elementValue.type === "number") {
                    const numValue = Number(elementValue.value);
                    if (!isNaN(numValue)) {
                      computedValue = numValue;
                    }
                  }

                  processedCells[cellRef] = {
                    ...cell,
                    value: String(elementValue.value),
                    formula: String(elementValue.value),
                    computed: computedValue,
                  };
                }
              }
            });

            return {
              ...sheet,
              cells: processedCells,
              columnWidths: { ...(template.cellsStyles?.columnWidths || {}) },
              rowHeights: { ...(template.cellsStyles?.rowHeights || {}) },
              templateHiddenRows: new Set<number>(
                template.cellsStyles?.hiddenRows || [],
              ),
              templateHiddenColumns: new Set<number>(
                template.cellsStyles?.hiddenColumns || [],
              ),
              userHiddenRows: new Set<number>(),
              userHiddenColumns: new Set<number>(),
              hiddenCells: new Set<string>(),
              freezeRow: template.cellsStyles?.freezeRow || 0,
              freezeColumn: template.cellsStyles?.freezeColumn || 0,
              mergedCells: template.cellsStyles?.mergedCells || [],
            };
          }
          return sheet;
        });

        // After loading template, recalculate all formulas
        const recalculateAllTemplateFormulas = async () => {
          const currentSheet = updatedSheets.find(
            (sheet) => sheet.id === activeSheetId,
          );
          if (!currentSheet) return;

          const newCells = { ...currentSheet.cells };
          const updatedComputedValues: Record<string, string | number> = {};

          // Process all cells to recalculate formulas
          for (const ref of Object.keys(newCells)) {
            try {
              const result = await evaluateFormula(
                newCells[ref].formula,
                newCells,
                updatedSheets,
              );
              updatedComputedValues[ref] = result !== undefined ? result : "";

              // Update the cell grid with the new computed value for next cell calculations
              newCells[ref] = {
                ...newCells[ref],
                computed: updatedComputedValues[ref],
              };
            } catch (error) {
              console.error(`Error calculating cell ${ref}:`, error);
              updatedComputedValues[ref] = "#ERROR";
              newCells[ref] = {
                ...newCells[ref],
                computed: "#ERROR",
              };
            }
          }

          // Apply all the computed values at once
          setSheets((latestSheets) =>
            latestSheets.map((sheet) => {
              if (sheet.id === activeSheetId) {
                const updatedCellsWithComputed = { ...sheet.cells };

                // Update computed values for all cells
                Object.keys(updatedComputedValues).forEach((ref) => {
                  if (updatedCellsWithComputed[ref]) {
                    updatedCellsWithComputed[ref] = {
                      ...updatedCellsWithComputed[ref],
                      computed: updatedComputedValues[ref],
                    };
                  }
                });

                return { ...sheet, cells: updatedCellsWithComputed };
              }
              return sheet;
            }),
          );
        };

        // Run the recalculation immediately after loading template
        recalculateAllTemplateFormulas();

        return updatedSheets;
      });

      setShowTemplateLibrary(false);
      setSelectedCell("A1");
      setSelectedCells(new Set(["A1"]));
      setFormulaInput("");
    },
    [activeSheetId, evaluateFormula, element.values, instanceId],
  );

  useEffect(() => {
    if (
      templates.length === 1 &&
      !initialTemplateLoaded &&
      Object.keys(sheetsInitialData[0].cells).length === 0
    ) {
      const initialTemplate = templates[0];
      loadTemplate(initialTemplate);
      setInitialTemplateLoaded(true);
    }
  }, [templates, initialTemplateLoaded, loadTemplate, sheetsInitialData]);

  return (
    <div className="w-full h-screen bg-white flex flex-col rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gray-100 border-b px-3 py-1.5">
        <FormulaBar
          selectedCell={selectedCell}
          currentSheetName={currentSheet?.name || ""}
          formulaInput={formulaInput}
          isFormulaBuildingMode={isFormulaBuildingMode}
          isAddingToFormula={isAddingToFormula}
          rangeSelectionStart={rangeSelectionStart}
          formulaCursorPosition={formulaCursorPosition}
          formulaInputRef={formulaInputRef}
          onFormulaChange={handleFormulaChange}
          onFormulaKeyPress={handleFormulaKeyPress}
          onFormulaFocus={() => setIsFormulaInputFocused(true)}
          onFormulaBlur={() => {
            setIsFormulaInputFocused(false);
            // Only update if value has changed and not in inline editing mode
            if (!editingCell) {
              const currentCell = cells[selectedCell];
              const currentValue =
                currentCell?.formula || currentCell?.value || "";
              if (formulaInput !== currentValue) {
                updateCell(selectedCell, formulaInput);
              }
            }
          }}
          updateCursorPosition={updateCursorPosition}
          onShowFunctionLibrary={() => setShowFunctionLibrary(true)}
          onToggleAddingToFormula={toggleAddingToFormula}
          onHandleRangeSelection={handleRangeSelection}
          onExitFormulaBuildingMode={exitFormulaBuildingMode}
        />

        {/* Cross-tab selector - only show when adding cells to formula */}
        {isFormulaBuildingMode && isAddingToFormula && (
          <CrossTabSelector
            allSheets={allSheets}
            currentInstanceId={instanceId}
            currentSheetId={activeSheetId}
            selectedTargetInstanceId={targetInstanceId}
            selectedTargetSheetId={targetSheetId}
            onInstanceChange={handleTargetInstanceChange}
            onSheetChange={handleTargetSheetChange}
          />
        )}
      </div>

      {/* Function Library Modal */}
      <FunctionLibraryModal
        isOpen={showFunctionLibrary}
        customFunctions={customFunctions}
        searchTerm={searchTerm}
        currentPage={currentPage}
        functionsPerPage={functionsPerPage}
        onClose={() => setShowFunctionLibrary(false)}
        onSearchChange={setSearchTerm}
        onPageChange={setCurrentPage}
        onInsertFunction={insertFunction}
      />

      <TemplateLibraryModal
        isOpen={showTemplateLibrary}
        onClose={() => setShowTemplateLibrary(false)}
        templates={templates}
        onLoadTemplate={loadTemplate}
        onSearchChange={setSearchTermTemplate}
        onPageChange={setCurrentPageTemplate}
        searchTerm={searchTermTemplate}
        currentPage={currentPageTemplate}
      />

      {/* Spreadsheet Grid */}
      <SpreadSheetGrid
        cells={cells}
        selectedCell={selectedCell}
        selectedCells={selectedCells}
        isAddingToFormula={isAddingToFormula}
        rangeSelectionStart={rangeSelectionStart}
        getColumnWidth={getColumnWidth}
        getRowHeight={getRowHeight}
        handleCellClick={handleCellClick}
        handleResizeStart={handleResizeStart}
        hiddenRows={hiddenRows}
        hiddenColumns={hiddenColumns}
        hiddenCells={currentSheet?.hiddenCells || new Set<string>()}
        freezeRow={currentSheet?.freezeRow || 0}
        freezeColumn={currentSheet?.freezeColumn || 0}
        mergedCells={currentSheet?.mergedCells || []}
        onRowHeaderContextMenu={handleRowHeaderContextMenu}
        onColumnHeaderContextMenu={handleColumnHeaderContextMenu}
        onCellContextMenu={handleCellContextMenu}
        onCellValueChange={handleDropdownCellChange}
        editingCell={editingCell}
        inlineCellValue={inlineCellValue}
        onStartInlineEditing={handleStartInlineEditing}
        onStopInlineEditing={handleStopInlineEditing}
        onNavigateAfterEdit={handleNavigateAfterEdit}
        onGridReady={handleGridReady}
        zoom={zoom}
      />

      {/* Context Menu */}
      {contextMenu.visible && (
        <>
          {/* Backdrop to close context menu when clicking outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() =>
              setContextMenu({
                visible: false,
                x: 0,
                y: 0,
                type: null,
                index: -1,
              })
            }
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({
                visible: false,
                x: 0,
                y: 0,
                type: null,
                index: -1,
              });
            }}
          />
          <div
            className="fixed bg-white border border-gray-300 shadow-lg rounded z-50"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {contextMenu.type === "row" && (
              <>
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                  onClick={() => hideRow(contextMenu.index)}
                >
                  Ocultar fila {contextMenu.index + 1}
                </button>
                {(currentSheet?.userHiddenRows?.size || 0) > 0 && (
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm border-t"
                    onClick={unhideAllRows}
                  >
                    Mostrar todas las filas
                  </button>
                )}
                <div className="border-t my-1"></div>
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                  onClick={() => freezeRowsOnly(contextMenu.index + 1)}
                >
                  🔒 Inmovilizar filas hasta fila {contextMenu.index + 1}
                </button>
                {(currentSheet?.freezeRow || 0) > 0 && (
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                    onClick={unfreezeRows}
                  >
                    🔓 Movilizar filas
                  </button>
                )}
              </>
            )}
            {contextMenu.type === "column" && (
              <>
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                  onClick={() => hideColumn(contextMenu.index)}
                >
                  Ocultar columna {getColumnLabel(contextMenu.index)}
                </button>
                {(currentSheet?.userHiddenColumns?.size || 0) > 0 && (
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm border-t"
                    onClick={unhideAllColumns}
                  >
                    Mostrar todas las columnas
                  </button>
                )}
                <div className="border-t my-1"></div>
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                  onClick={() => freezeColumnsOnly(contextMenu.index + 1)}
                >
                  🔒 Inmovilizar columnas hasta columna{" "}
                  {getColumnLabel(contextMenu.index)}
                </button>
                {(currentSheet?.freezeColumn || 0) > 0 && (
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                    onClick={unfreezeColumns}
                  >
                    🔓 Movilizar columnas
                  </button>
                )}
              </>
            )}
            {contextMenu.type === "cell" &&
              contextMenu.cellRef &&
              (() => {
                const isCellHidden = currentSheet?.hiddenCells?.has(
                  contextMenu.cellRef,
                );
                const pos = parseCellRef(contextMenu.cellRef);
                const hasFrozenPanes =
                  (currentSheet?.freezeRow || 0) > 0 ||
                  (currentSheet?.freezeColumn || 0) > 0;

                // Check if cell is part of a merged region
                const isMerged = currentSheet?.mergedCells.some((merge) => {
                  const mergeStart = parseCellRef(merge.startCell);
                  const mergeEnd = parseCellRef(merge.endCell);
                  if (!mergeStart || !mergeEnd || !pos) return false;
                  return (
                    pos.row >= mergeStart.row &&
                    pos.row <= mergeEnd.row &&
                    pos.col >= mergeStart.col &&
                    pos.col <= mergeEnd.col
                  );
                });

                const canMerge = selectedCells.size > 1;

                return (
                  <>
                    {canMerge && (
                      <>
                        <button
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                          onClick={mergeCells}
                        >
                          🔗 Combinar celdas
                        </button>
                        <div className="border-t my-1"></div>
                      </>
                    )}
                    {isMerged && (
                      <>
                        <button
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                          onClick={unmergeCells}
                        >
                          ✂️ Separar celdas
                        </button>
                        <div className="border-t my-1"></div>
                      </>
                    )}
                    {isCellHidden ? (
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        onClick={() => unhideCell(contextMenu.cellRef!)}
                      >
                        Mostrar celda {contextMenu.cellRef}
                      </button>
                    ) : (
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        onClick={() => hideCell(contextMenu.cellRef!)}
                      >
                        Ocultar celda {contextMenu.cellRef}
                      </button>
                    )}
                    {pos && (
                      <>
                        <div className="border-t my-1"></div>
                        <button
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                          onClick={() => freezePanes(pos.row, pos.col)}
                        >
                          🔒 Inmovilizar paneles aquí
                        </button>
                        {hasFrozenPanes && (
                          <button
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                            onClick={unfreezePanes}
                          >
                            🔓 Movilizar paneles
                          </button>
                        )}
                      </>
                    )}
                    <div className="border-t my-1"></div>
                    <button
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                      onClick={() => {
                        const existingNote =
                          currentSheet?.cells[contextMenu.cellRef!]?.note || "";
                        setNoteModal({
                          visible: true,
                          cellRef: contextMenu.cellRef!,
                          value: existingNote,
                        });
                        setContextMenu({
                          visible: false,
                          x: 0,
                          y: 0,
                          type: null,
                          index: -1,
                        });
                      }}
                    >
                      📝{" "}
                      {currentSheet?.cells[contextMenu.cellRef!]?.note
                        ? "Editar nota"
                        : "Agregar nota"}
                    </button>
                    {currentSheet?.cells[contextMenu.cellRef!]?.note && (
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm text-red-600"
                        onClick={() => {
                          const ref = contextMenu.cellRef!;
                          setSheets((prev) =>
                            prev.map((sheet) => {
                              if (sheet.id !== activeSheetId) return sheet;
                              const newCells = { ...sheet.cells };
                              if (newCells[ref]) {
                                newCells[ref] = { ...newCells[ref] };
                                delete newCells[ref].note;
                              }
                              return { ...sheet, cells: newCells };
                            }),
                          );
                          setContextMenu({
                            visible: false,
                            x: 0,
                            y: 0,
                            type: null,
                            index: -1,
                          });
                        }}
                      >
                        🗑️ Eliminar nota
                      </button>
                    )}
                  </>
                );
              })()}
          </div>
        </>
      )}

      {/* Note Editing Modal */}
      {noteModal.visible && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-50"
            onClick={() =>
              setNoteModal({ visible: false, cellRef: "", value: "" })
            }
          />
          <div
            className="fixed z-50 bg-white border border-gray-300 shadow-xl rounded-lg p-4 w-80"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                📝 Nota - {noteModal.cellRef}
              </h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() =>
                  setNoteModal({ visible: false, cellRef: "", value: "" })
                }
              >
                ✕
              </button>
            </div>
            <textarea
              className="w-full border border-gray-300 rounded p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              rows={4}
              value={noteModal.value}
              onChange={(e) =>
                setNoteModal((prev) => ({ ...prev, value: e.target.value }))
              }
              placeholder="Escribe una nota..."
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
                onClick={() =>
                  setNoteModal({ visible: false, cellRef: "", value: "" })
                }
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => {
                  const { cellRef, value } = noteModal;
                  setSheets((prev) =>
                    prev.map((sheet) => {
                      if (sheet.id !== activeSheetId) return sheet;
                      const newCells = { ...sheet.cells };
                      const existingCell = newCells[cellRef] || {
                        value: "",
                        formula: "",
                        computed: "",
                      };
                      if (value.trim()) {
                        newCells[cellRef] = {
                          ...existingCell,
                          note: value.trim(),
                        };
                      } else {
                        newCells[cellRef] = { ...existingCell };
                        delete newCells[cellRef].note;
                      }
                      return { ...sheet, cells: newCells };
                    }),
                  );
                  setNoteModal({ visible: false, cellRef: "", value: "" });
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sheet Tabs */}
      <SheetTabs
        sheets={sheets}
        activeSheetId={activeSheetId}
        editingSheetName={editingSheetName}
        onSwitchToSheet={switchToSheet}
        onDeleteSheet={deleteSheet}
        onSheetNameKeyPress={handleSheetNameKeyPress}
        onSetEditingSheetName={setEditingSheetName}
        onAddNewSheet={addNewSheet}
        selectionStats={selectionStats}
        zoom={zoom}
        onZoomChange={setZoom}
      />
    </div>
  );
};

export default SpreadSheet;
