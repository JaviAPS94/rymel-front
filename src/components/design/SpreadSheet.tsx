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
  Accessory,
  BomNode,
  BomResponse,
  CellGrid,
  DesignSubtype,
  ElementResponse,
  Template,
} from "../../commons/types";
import {
  useEvaluateFunctionMutation,
  useGetSemiFinishedQuery,
  useLazyGetBomByCodeQuery,
} from "../../store";

// Import new components
import FormulaBar from "./FormulaBar";
import SpreadSheetGrid from "./SpreadSheetGrid";
import SheetTabs from "./SheetTabs";
import ItemPickerModal, { CatalogEntry } from "./ItemPickerModal";
import CrossTabSelector from "./CrossTabSelector";
import FunctionLibraryModal from "./FunctionLibraryModal";
import TemplateLibraryModal from "./TemplateLibraryModal";
import {
  Cell,
  CellItemLink,
  CustomFunction,
  ItemCatalogTable,
  NamedRange,
  SemiFinishedZone,
  Sheet,
  getSemiFinishedColor,
} from "./spreadsheet-types";
import Select, { Option } from "../core/Select";
import { useDepGraph } from "../../hooks/useDepGraph";

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
  const [borderColor, setBorderColor] = useState<string>("#000000");
  const [cellBold, setCellBold] = useState<boolean>(false);
  const [cellDecimals, setCellDecimals] = useState<number | undefined>(
    undefined,
  );
  const [condFmtMin, setCondFmtMin] = useState<string>("");
  const [condFmtMax, setCondFmtMax] = useState<string>("");
  const [condFmtColor, setCondFmtColor] = useState<string>("#ff0000");
  // GoTo navigation highlight animation
  const [goToHighlight, setGoToHighlight] = useState<string | null>(null);

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
        borderTop?: string;
        borderRight?: string;
        borderBottom?: string;
        borderLeft?: string;
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
        borderTop: string;
        borderRight: string;
        borderBottom: string;
        borderLeft: string;
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

  // Handler to apply outside borders only to the outer edges of the selection
  const applyOutsideBorders = useCallback(
    (borderStyle: string) => {
      saveToHistoryImmediate();

      // Parse selected cells to find the bounding box
      const coords: { col: number; row: number; ref: string }[] = [];
      selectedCells.forEach((cellRef) => {
        const match = cellRef.match(/^([A-Z]+)(\d+)$/);
        if (!match) return;
        coords.push({
          col: getColumnIndex(match[1]),
          row: parseInt(match[2], 10),
          ref: cellRef,
        });
      });

      if (coords.length === 0) return;

      const minCol = Math.min(...coords.map((c) => c.col));
      const maxCol = Math.max(...coords.map((c) => c.col));
      const minRow = Math.min(...coords.map((c) => c.row));
      const maxRow = Math.max(...coords.map((c) => c.row));

      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          const updatedCells = { ...sheet.cells };

          selectedCells.forEach((cellRef) => {
            const match = cellRef.match(/^([A-Z]+)(\d+)$/);
            if (!match) return;
            const col = getColumnIndex(match[1]);
            const row = parseInt(match[2], 10);

            const isTop = row === minRow;
            const isBottom = row === maxRow;
            const isLeft = col === minCol;
            const isRight = col === maxCol;

            // Clear all individual borders and shorthand first, then set only outer edges
            updatedCells[cellRef] = {
              ...updatedCells[cellRef],
              border: undefined,
              borderTop: isTop ? borderStyle : undefined,
              borderBottom: isBottom ? borderStyle : undefined,
              borderLeft: isLeft ? borderStyle : undefined,
              borderRight: isRight ? borderStyle : undefined,
            };
          });

          return { ...sheet, cells: updatedCells };
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
        {/* All borders */}
        <button
          type="button"
          title="Todos los bordes"
          onClick={() => {
            const style = `1px solid ${borderColor}`;
            updateCellStyle({
              border: style,
              borderTop: "",
              borderRight: "",
              borderBottom: "",
              borderLeft: "",
            });
          }}
          className="w-7 h-7 flex items-center justify-center border rounded hover:bg-gray-100"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke={borderColor}
            strokeWidth="1.2"
          >
            <rect x="1" y="1" width="14" height="14" />
            <line x1="8" y1="1" x2="8" y2="15" />
            <line x1="1" y1="8" x2="15" y2="8" />
          </svg>
        </button>
        {/* Outside borders */}
        <button
          type="button"
          title="Bordes exteriores"
          onClick={() => {
            const style = `1px solid ${borderColor}`;
            applyOutsideBorders(style);
          }}
          className="w-7 h-7 flex items-center justify-center border rounded hover:bg-gray-100"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke={borderColor}
            strokeWidth="1.8"
          >
            <rect x="1" y="1" width="14" height="14" />
          </svg>
        </button>
        {/* No border */}
        <button
          type="button"
          title="Sin borde"
          onClick={() => {
            updateCellStyle({
              border: "",
              borderTop: "",
              borderRight: "",
              borderBottom: "",
              borderLeft: "",
            });
          }}
          className="w-7 h-7 flex items-center justify-center border rounded hover:bg-gray-100"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#999"
            strokeWidth="1"
            strokeDasharray="2 2"
          >
            <rect x="1" y="1" width="14" height="14" />
          </svg>
        </button>
        {/* Border color picker */}
        <input
          type="color"
          value={borderColor}
          title="Color de borde"
          onChange={(e) => setBorderColor(e.target.value)}
          className="w-6 h-6 p-0 border rounded cursor-pointer"
        />
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

  // GoTo / Named Range modal states
  const [goToConfigModal, setGoToConfigModal] = useState<{
    visible: boolean;
    cellRef: string;
    conditionCells: string; // comma-separated cell refs
  }>({ visible: false, cellRef: "", conditionCells: "" });

  const [namedRangeModal, setNamedRangeModal] = useState<{
    visible: boolean;
    editId: string | null; // null = create new, string = edit existing
    name: string;
    tags: string; // comma-separated tags
    startCell: string;
    endCell: string;
  }>({
    visible: false,
    editId: null,
    name: "",
    tags: "",
    startCell: "",
    endCell: "",
  });

  // Semi-finished zone modal state
  const [semiFinishedZoneModal, setSemiFinishedZoneModal] = useState<{
    visible: boolean;
    editId: string | null;
    semiFinishedId: number | null;
    startCell: string;
    endCell: string;
  }>({
    visible: false,
    editId: null,
    semiFinishedId: null,
    startCell: "",
    endCell: "",
  });

  // Item catalog table modal state
  const [catalogTableModal, setCatalogTableModal] = useState<{
    visible: boolean;
    editId: string | null;
    name: string;
    tagsInput: string; // comma-separated, parsed on save
    startCell: string;
    endCell: string;
    headerRows: number;
    idColumnOffset: number;
    descriptionColumnOffset: number;
    umColumnOffset: number;
  }>({
    visible: false,
    editId: null,
    name: "",
    tagsInput: "",
    startCell: "",
    endCell: "",
    headerRows: 1,
    idColumnOffset: 0,
    descriptionColumnOffset: 1,
    umColumnOffset: 2,
  });

  // "Configurar vínculo al catálogo" modal — lets the user pick which cells
  // act as conditions; their values are matched against catalog tags to
  // auto-route the ItemPickerModal to the right catalog.
  const [catalogConditionModal, setCatalogConditionModal] = useState<{
    visible: boolean;
    cellRef: string | null;
    conditionCellsInput: string; // comma-separated
  }>({
    visible: false,
    cellRef: null,
    conditionCellsInput: "",
  });

  // ItemPickerModal state. When open, shows the catalogs filtered by the source
  // cell's catalogConditionCells (matched against catalog tags). `showAll`
  // bypasses the filter — useful as a fallback when nothing matches.
  const [itemPickerModal, setItemPickerModal] = useState<{
    isOpen: boolean;
    sourceCellRef: string | null;
    sourceSheetId: string | null;
    showAll: boolean;
  }>({
    isOpen: false,
    sourceCellRef: null,
    sourceSheetId: null,
    showAll: false,
  });

  // Load semi-finished products for zone assignment
  const { data: semiFinishedList, isLoading: isLoadingSemiFinished } =
    useGetSemiFinishedQuery(null);

  const [triggerGetBom] = useLazyGetBomByCodeQuery();
  const [bomExpandedChildNodes, setBomExpandedChildNodes] = useState<Set<number>>(new Set());
  const bomDataRef = useRef<BomResponse | null>(null);

  // Options shape expected by the project's custom Select
  const semiFinishedOptions = useMemo<Option<number>[]>(
    () =>
      (semiFinishedList || []).map((sf) => ({
        label: `${sf.name} (${sf.code})`,
        value: sf.id,
      })),
    [semiFinishedList],
  );

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

  // Compute set of cells that are the start of a named range (for visual indicator)
  const namedRangeStartCells = useMemo(() => {
    const startCells = new Set<string>();
    (currentSheet?.namedRanges || []).forEach((r) => {
      startCells.add(r.startCell);
    });
    return startCells;
  }, [currentSheet?.namedRanges]);

  // Map cellRef -> zone metadata for rendering (color tint + badge).
  // Recomputed only when the zones array changes. Cell -> 1 zone (no overlap).
  const cellZoneMap = useMemo(() => {
    const map = new Map<
      string,
      {
        zoneId: string;
        code: string;
        name: string;
        bg: string;
        border: string;
        text: string;
        isStart: boolean;
      }
    >();
    (currentSheet?.semiFinishedZones || []).forEach((zone) => {
      const start = zone.startCell.match(/^([A-Z]+)(\d+)$/);
      const end = zone.endCell.match(/^([A-Z]+)(\d+)$/);
      if (!start || !end) return;
      const startCol = getColumnIndex(start[1]);
      const startRow = Number.parseInt(start[2]) - 1;
      const endCol = getColumnIndex(end[1]);
      const endRow = Number.parseInt(end[2]) - 1;
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      const palette = getSemiFinishedColor(zone.semiFinishedCode);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const ref = `${getColumnLabel(c)}${r + 1}`;
          map.set(ref, {
            zoneId: zone.id,
            code: zone.semiFinishedCode,
            name: zone.semiFinishedName,
            bg: palette.bg,
            border: palette.border,
            text: palette.text,
            isStart: r === minRow && c === minCol,
          });
        }
      }
    });
    return map;
  }, [currentSheet?.semiFinishedZones]);

  // Map cellRef -> item catalog table metadata for rendering an outlined frame
  // around each table (top/right/bottom/left borders on the rectangle edges)
  // and a name badge at the top-left cell. Multiple catalog tables in the same
  // sheet are not expected to overlap; if they do, the last wins (save guards).
  const catalogCellMap = useMemo(() => {
    const map = new Map<
      string,
      {
        tableId: string;
        tableName: string;
        isStart: boolean;
        edgeTop: boolean;
        edgeRight: boolean;
        edgeBottom: boolean;
        edgeLeft: boolean;
      }
    >();
    (currentSheet?.itemCatalogTables || []).forEach((table) => {
      const start = table.startCell.match(/^([A-Z]+)(\d+)$/);
      const end = table.endCell.match(/^([A-Z]+)(\d+)$/);
      if (!start || !end) return;
      const startCol = getColumnIndex(start[1]);
      const startRow = Number.parseInt(start[2]) - 1;
      const endCol = getColumnIndex(end[1]);
      const endRow = Number.parseInt(end[2]) - 1;
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const ref = `${getColumnLabel(c)}${r + 1}`;
          map.set(ref, {
            tableId: table.id,
            tableName: table.name,
            isStart: r === minRow && c === minCol,
            edgeTop: r === minRow,
            edgeRight: c === maxCol,
            edgeBottom: r === maxRow,
            edgeLeft: c === minCol,
          });
        }
      }
    });
    return map;
  }, [currentSheet?.itemCatalogTables]);

  // Dependency graph for incremental recalculation
  const { buildGraph, updateCellInGraph, getRecalcOrder } = useDepGraph();

  // Rebuild the dependency graph whenever the active sheet changes
  useEffect(() => {
    if (currentSheet?.cells) {
      buildGraph(currentSheet.cells);
    }
  }, [activeSheetId]); // Only rebuild when switching sheets, not on every cell change
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

  // Etiqueta una celda como "MO" o "MD" (material de devanado) para el código de diseño.
  // La etiqueta es exclusiva dentro de todo el diseño (todas las hojas): al asignarla a una
  // celda nueva, se quita automáticamente de cualquier otra celda que ya la tuviera.
  const tagCellAsMaterial = useCallback(
    (cellRef: string, tag: "MO" | "MD") => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          const isTargetSheet = sheet.id === activeSheetId;
          let changed = false;
          const newCells = { ...sheet.cells };

          for (const [ref, cell] of Object.entries(newCells)) {
            if (cell.materialTag === tag && !(isTargetSheet && ref === cellRef)) {
              newCells[ref] = { ...cell, materialTag: undefined };
              changed = true;
            }
          }

          if (isTargetSheet) {
            const existing =
              newCells[cellRef] ?? { value: "", formula: "", computed: "" };
            newCells[cellRef] = { ...existing, materialTag: tag };
            changed = true;
          }

          return changed ? { ...sheet, cells: newCells } : sheet;
        }),
      );
      setContextMenu({ visible: false, x: 0, y: 0, type: null, index: -1 });
    },
    [activeSheetId],
  );

  const clearCellMaterialTag = useCallback(
    (cellRef: string) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          const newCells = { ...sheet.cells };
          if (newCells[cellRef]) {
            newCells[cellRef] = { ...newCells[cellRef] };
            delete newCells[cellRef].materialTag;
          }
          return { ...sheet, cells: newCells };
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
            let cellValue: number | string;
            if (!arg.includes("!") && _cellGrid[arg]) {
              const c = _cellGrid[arg];
              cellValue =
                typeof c.computed === "number"
                  ? c.computed
                  : c.computed !== undefined &&
                      c.computed !== "" &&
                      !isNaN(Number(c.computed))
                    ? Number(c.computed)
                    : 0;
            } else {
              cellValue = getCellValueFromAnySheet(arg, currentSheets);
            }
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

      // Passthrough: DRAW: graphic formulas are not math expressions
      if (expression.startsWith("DRAW:")) {
        return expression;
      }

      // Helper: resolve cell value from cellGrid (same-sheet, up-to-date) or sheets (cross-sheet)
      const resolveCellValue = (ref: string): number | string => {
        if (!ref.includes("!")) {
          const cell = cellGrid[ref];
          if (cell && cell.computed !== undefined && cell.computed !== "") {
            if (typeof cell.computed === "number") return cell.computed;
            const num = Number(cell.computed);
            if (!isNaN(num)) return num;
          }
          return 0;
        }
        return getCellValueFromAnySheet(ref, currentSheets);
      };

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
              const cellValue = resolveCellValue(ref);
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
              const cellValue = resolveCellValue(ref);
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
              const cellValue = resolveCellValue(cleanMatch);
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
              const cellValue = resolveCellValue(cleanMatch);
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
            searchValue = resolveCellValue(cleanRef);
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
                  const cellValue = resolveCellValue(cleanRef);
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
                    const cellValue = resolveCellValue(cleanRef);
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
            const cellValue = resolveCellValue(cleanMatch);
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

          // Build dependency graph for this sheet and get topological order
          buildGraph(newCells);
          const formulaCells = Object.keys(newCells).filter((ref) =>
            newCells[ref]?.formula?.startsWith("="),
          );
          const { order, circular } = getRecalcOrder(formulaCells);

          // Mark circular references
          circular.forEach((ref) => {
            updatedComputedValues[ref] = "#CIRCULAR";
            newCells[ref] = { ...newCells[ref], computed: "#CIRCULAR" };
          });

          // Process non-formula cells first (plain values)
          for (const ref of Object.keys(newCells)) {
            if (!newCells[ref]?.formula?.startsWith("=")) {
              try {
                const result = await evaluateFormula(
                  newCells[ref].formula,
                  newCells,
                  normalizedSheets,
                );
                updatedComputedValues[ref] = result !== undefined ? result : "";
                newCells[ref] = {
                  ...newCells[ref],
                  computed: updatedComputedValues[ref],
                };
              } catch {
                // Plain values shouldn't error
              }
            }
          }

          // Process formula cells in topological order
          for (const ref of order) {
            if (!newCells[ref]?.formula?.startsWith("=")) continue;
            try {
              const result = await evaluateFormula(
                newCells[ref].formula,
                newCells,
                normalizedSheets,
              );
              updatedComputedValues[ref] = result !== undefined ? result : "";
              newCells[ref] = {
                ...newCells[ref],
                computed: updatedComputedValues[ref],
              };
            } catch (error) {
              console.error(`Error calculating cell ${ref}:`, error);
              updatedComputedValues[ref] = "#ERROR";
              newCells[ref] = { ...newCells[ref], computed: "#ERROR" };
            }
          }

          updatedSheets.push({ ...sheet, cells: newCells });
        }

        // Update all sheets with recalculated formulas
        setSheets(updatedSheets);

        // Rebuild graph for the active sheet so edits work immediately
        const activeSheet = updatedSheets.find(
          (s) => s.id === normalizedSheets[0]?.id,
        );
        if (activeSheet) {
          buildGraph(activeSheet.cells);
        }
      };

      // Run the recalculation after a short delay to ensure the component is properly mounted
      setTimeout(() => {
        recalculateAllSheetsFormulas();
      }, 100);
    }
  }, [
    sheetsInitialData,
    evaluateFormula,
    initialSheetsLoaded,
    buildGraph,
    getRecalcOrder,
  ]);

  /**
   * Incremental recalculation helper.
   * Given a set of dirty cells, uses the dependency graph to find all
   * affected cells and recalculates them in topological order.
   */
  const recalcDirtyCells = useCallback(
    async (
      dirtyCells: string[],
      cellGrid: CellGrid,
      allSheets: Sheet[],
    ): Promise<Record<string, string | number>> => {
      const { order, circular } = getRecalcOrder(dirtyCells);
      const updatedValues: Record<string, string | number> = {};

      // Mark circular references
      circular.forEach((ref) => {
        updatedValues[ref] = "#CIRCULAR";
        cellGrid[ref] = { ...cellGrid[ref], computed: "#CIRCULAR" };
      });

      // Recalculate in topological order (dependencies first)
      for (const ref of order) {
        const cellToCalc = cellGrid[ref];
        if (!cellToCalc) continue;

        // Skip non-formula cells unless they are the originally dirty cell
        if (!cellToCalc.formula?.startsWith("=") && !dirtyCells.includes(ref))
          continue;

        try {
          const result = await evaluateFormula(
            cellToCalc.formula,
            cellGrid,
            allSheets,
          );
          updatedValues[ref] = result !== undefined ? result : "";
          cellGrid[ref] = { ...cellGrid[ref], computed: updatedValues[ref] };
        } catch (error) {
          console.error(`Error calculating cell ${ref}:`, error);
          updatedValues[ref] = "#ERROR";
          cellGrid[ref] = { ...cellGrid[ref], computed: "#ERROR" };
        }
      }

      return updatedValues;
    },
    [evaluateFormula, getRecalcOrder],
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

      // Incrementally update the dependency graph for this cell
      updateCellInGraph(cellRef, value);

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

        // Schedule async incremental recalculation for this cell + all dependents
        Promise.resolve().then(async () => {
          const updatedComputedValues = await recalcDirtyCells(
            [cellRef],
            { ...newCells },
            prevSheets,
          );

          if (Object.keys(updatedComputedValues).length > 0) {
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
          }
        });

        // Return updated sheets with new cell values (computed values will be updated asynchronously)
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
      recalcDirtyCells,
      updateCellInGraph,
      saveToHistoryDebounced,
      saveToHistoryImmediate,
    ],
  );

  // Handler for updating dropdown cell values
  const handleDropdownCellChange = useCallback(
    async (cellRef: string, value: string) => {
      // Save current state to history before making changes (immediate for dropdown)
      saveToHistoryImmediate();

      // Update dep graph (dropdown values don't have formulas but dependents may need recalc)
      updateCellInGraph(cellRef, value);

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

        // Schedule async incremental recalculation
        Promise.resolve().then(async () => {
          const updatedComputedValues = await recalcDirtyCells(
            [cellRef],
            { ...newCells },
            prevSheets,
          );

          if (Object.keys(updatedComputedValues).length > 0) {
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
          }
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
      recalcDirtyCells,
      updateCellInGraph,
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
        borderTop?: string;
        borderRight?: string;
        borderBottom?: string;
        borderLeft?: string;
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
          borderTop: cell?.borderTop,
          borderRight: cell?.borderRight,
          borderBottom: cell?.borderBottom,
          borderLeft: cell?.borderLeft,
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

      // Recalculate formulas after paste using dep graph
      setTimeout(async () => {
        // Update dep graph for all pasted cells
        const pastedRefs = newCellsData.map((d) => d.cellRef);

        setSheets((prevSheets) => {
          const currentSheet = prevSheets.find((s) => s.id === activeSheetId);
          if (!currentSheet) return prevSheets;

          const updatedCells = { ...currentSheet.cells };

          // Update the dep graph for each pasted cell
          pastedRefs.forEach((ref) => {
            updateCellInGraph(ref, updatedCells[ref]?.formula || "");
          });

          // Rebuild graph to capture all new dependencies from pasted formulas
          buildGraph(updatedCells);

          return prevSheets;
        });

        // Now recalculate all affected cells
        setSheets((prevSheets) => {
          const currentSheet = prevSheets.find((s) => s.id === activeSheetId);
          if (!currentSheet) return prevSheets;

          const updatedCells = { ...currentSheet.cells };

          recalcDirtyCells(pastedRefs, updatedCells, prevSheets).then(
            (updatedComputedValues) => {
              if (Object.keys(updatedComputedValues).length > 0) {
                setSheets((latestSheets) =>
                  latestSheets.map((sheet) => {
                    if (sheet.id === activeSheetId) {
                      const finalCells = { ...sheet.cells };
                      Object.keys(updatedComputedValues).forEach((ref) => {
                        if (finalCells[ref]) {
                          finalCells[ref] = {
                            ...finalCells[ref],
                            computed: updatedComputedValues[ref],
                          };
                        }
                      });
                      return { ...sheet, cells: finalCells };
                    }
                    return sheet;
                  }),
                );
              }
            },
          );

          return prevSheets;
        });
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
          borderTop: cellData.borderTop,
          borderRight: cellData.borderRight,
          borderBottom: cellData.borderBottom,
          borderLeft: cellData.borderLeft,
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

    // Recalculate formulas after paste using dep graph
    setTimeout(async () => {
      const pastedRefs = newCellsData.map((d) => d.cellRef);

      setSheets((prevSheets) => {
        const currentSheet = prevSheets.find((s) => s.id === activeSheetId);
        if (!currentSheet) return prevSheets;

        const updatedCells = { ...currentSheet.cells };

        // Update dep graph for pasted cells and rebuild
        pastedRefs.forEach((ref) => {
          updateCellInGraph(ref, updatedCells[ref]?.formula || "");
        });
        buildGraph(updatedCells);

        return prevSheets;
      });

      setSheets((prevSheets) => {
        const currentSheet = prevSheets.find((s) => s.id === activeSheetId);
        if (!currentSheet) return prevSheets;

        const updatedCells = { ...currentSheet.cells };

        recalcDirtyCells(pastedRefs, updatedCells, prevSheets).then(
          (updatedComputedValues) => {
            if (Object.keys(updatedComputedValues).length > 0) {
              setSheets((latestSheets) =>
                latestSheets.map((sheet) => {
                  if (sheet.id === activeSheetId) {
                    const finalCells = { ...sheet.cells };
                    Object.keys(updatedComputedValues).forEach((ref) => {
                      if (finalCells[ref]) {
                        finalCells[ref] = {
                          ...finalCells[ref],
                          computed: updatedComputedValues[ref],
                        };
                      }
                    });
                    return { ...sheet, cells: finalCells };
                  }
                  return sheet;
                }),
              );
            }
          },
        );

        return prevSheets;
      });
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
    recalcDirtyCells,
    updateCellInGraph,
    buildGraph,
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

    // BOM toggle: clicking the ▶/▼ cell in column A of a child SF row
    const activeSheet = sheets.find((s) => s.id === activeSheetId);
    if (activeSheet?.isBomSummary) {
      const clickedCell = activeSheet.cells[cellRef];
      if (clickedCell?.bomToggleNodeId !== undefined) {
        toggleBomNode(clickedCell.bomToggleNodeId);
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
    (direction: "up" | "down" | "left" | "right") => {
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
      newSheet.namedRanges = template.cellsStyles?.namedRanges || [];
      newSheet.semiFinishedZones =
        template.cellsStyles?.semiFinishedZones || [];
      newSheet.itemCatalogTables =
        template.cellsStyles?.itemCatalogTables || [];
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

  // Build BOM summary cells from the tree returned by the BOM API.
  // Children are rendered before their parent (post-order DFS) so leaf SFs
  // appear first, and each parent section shows its direct children as
  // collapsible orange reference rows before the regular item rows.
  // expandedChildNodes controls which child SF nodes show their items inline.
  const buildBomSummaryCells = (
    bom: BomResponse,
    expandedChildNodes: Set<number>,
  ): { [key: string]: Cell } => {
    const cells: { [key: string]: Cell } = {};
    let row = 0;

    // Collect item rows for a given SF id (logic unchanged from original)
    const collectItemRows = (sfId: number) => {
      const itemRows: {
        itemId: string;
        description: string;
        cantidad: string;
        um: string;
      }[] = [];
      sheets.forEach((sheet) => {
        (sheet.semiFinishedZones || []).forEach((zone) => {
          if (zone.semiFinishedId !== sfId) return;
          if (!zone.startCell || !zone.endCell) return;
          const start = parseCellRef(zone.startCell);
          const end = parseCellRef(zone.endCell);
          if (!start || !end) return;
          const minRow = Math.min(start.row, end.row);
          const maxRow = Math.max(start.row, end.row);
          const minCol = Math.min(start.col, end.col);
          const maxCol = Math.max(start.col, end.col);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              const ref = `${getColumnLabel(c)}${r + 1}`;
              const cell = sheet.cells[ref];
              const link = cell?.itemLink;
              if (!link) continue;
              const cantidad = readCellDisplayValue(cell);
              const table = catalogResolver.get(link.catalogTableId);
              let description = "(catálogo borrado)";
              let um = "";
              if (table) {
                const item = table.itemsById.get(link.itemId);
                if (item) {
                  description = item.description;
                  um = item.um;
                } else {
                  description = "(item no encontrado)";
                }
              }
              itemRows.push({ itemId: link.itemId, description, cantidad, um });
            }
          }
        });
      });
      return itemRows;
    };

    // Collect accessory rows for a given SF id from element.values["accesories"]
    const collectAccessoryRows = (sfId: number) => {
      const accEntry = element.values.find(
        (v: Record<string, unknown>) => v["key"] === "accesories",
      );
      if (!accEntry || !accEntry["value"]) return [];
      let accessories: Accessory[] = [];
      try {
        const raw = accEntry["value"];
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        accessories = Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
      return accessories
        .filter((acc) => acc.semiFinished?.id === sfId)
        .map((acc) => ({
          itemId: String(acc.id),
          description: acc.description,
          cantidad: String(acc.value ?? ""),
          um: acc.unitOfMeasurement ?? "",
        }));
    };

    // Post-order DFS: collect nodes leaf-first so child sections precede parents
    const collectNodes = (nodes: BomNode[]): BomNode[] => {
      const result: BomNode[] = [];
      for (const node of nodes) {
        result.push(...collectNodes(node.children));
        result.push(node);
      }
      return result;
    };

    const orderedNodes = collectNodes(bom.nodes);

    orderedNodes.forEach((node) => {
      const sf = node.semiFinished;
      const itemRows = collectItemRows(sf.id);
      const accessoryRows = collectAccessoryRows(sf.id);

      // Section title row
      cells[`A${row + 1}`] = {
        value: String(sf.id),
        formula: "",
        computed: String(sf.id),
        bold: true,
      };
      cells[`B${row + 1}`] = {
        value: `Semielaborado : ${sf.name}`,
        formula: "",
        computed: `Semielaborado : ${sf.name}`,
        bold: true,
        textColor: "#7c3aed",
      };
      row++;

      // Sub-header row
      const subHeaderStyle = {
        bold: true,
        backgroundColor: "#dbeafe",
      };
      cells[`B${row + 1}`] = {
        value: "Item",
        formula: "",
        computed: "Item",
        ...subHeaderStyle,
      };
      cells[`C${row + 1}`] = {
        value: "Descripción",
        formula: "",
        computed: "Descripción",
        ...subHeaderStyle,
      };
      cells[`D${row + 1}`] = {
        value: "Cantidad",
        formula: "",
        computed: "Cantidad",
        ...subHeaderStyle,
      };
      cells[`E${row + 1}`] = {
        value: "U.M.",
        formula: "",
        computed: "U.M.",
        ...subHeaderStyle,
      };
      row++;

      // Child SF reference rows with toggle indicator in column A.
      // When expanded, the child's items are shown inline below the toggle row.
      const childSfStyle = { backgroundColor: "#fed7aa" };
      const childExpandedItemStyle = { backgroundColor: "#fff7ed" };
      node.children.forEach((child) => {
        const childSf = child.semiFinished;
        const isExpanded = expandedChildNodes.has(child.id);

        cells[`A${row + 1}`] = {
          value: isExpanded ? "▼" : "▶",
          formula: "",
          computed: isExpanded ? "▼" : "▶",
          bomToggleNodeId: child.id,
          ...childSfStyle,
        };
        cells[`B${row + 1}`] = {
          value: childSf.code,
          formula: "",
          computed: childSf.code,
          ...childSfStyle,
        };
        cells[`C${row + 1}`] = {
          value: `Semielaborado : ${childSf.name}`,
          formula: "",
          computed: `Semielaborado : ${childSf.name}`,
          ...childSfStyle,
        };
        cells[`D${row + 1}`] = {
          value: "1",
          formula: "",
          computed: "1",
          ...childSfStyle,
        };
        cells[`E${row + 1}`] = {
          value: "UND",
          formula: "",
          computed: "UND",
          ...childSfStyle,
        };
        row++;

        if (isExpanded) {
          [...collectItemRows(childSf.id), ...collectAccessoryRows(childSf.id)].forEach((r) => {
            cells[`B${row + 1}`] = {
              value: r.itemId,
              formula: "",
              computed: r.itemId,
              ...childExpandedItemStyle,
            };
            cells[`C${row + 1}`] = {
              value: r.description,
              formula: "",
              computed: r.description,
              ...childExpandedItemStyle,
            };
            cells[`D${row + 1}`] = {
              value: r.cantidad,
              formula: "",
              computed: r.cantidad,
              ...childExpandedItemStyle,
            };
            cells[`E${row + 1}`] = {
              value: r.um,
              formula: "",
              computed: r.um,
              ...childExpandedItemStyle,
            };
            row++;
          });
        }
      });

      // Regular item rows of this node (from spreadsheet zones + element accessories)
      [...itemRows, ...accessoryRows].forEach((r) => {
        cells[`B${row + 1}`] = {
          value: r.itemId,
          formula: "",
          computed: r.itemId,
        };
        cells[`C${row + 1}`] = {
          value: r.description,
          formula: "",
          computed: r.description,
        };
        cells[`D${row + 1}`] = {
          value: r.cantidad,
          formula: "",
          computed: r.cantidad,
        };
        cells[`E${row + 1}`] = {
          value: r.um,
          formula: "",
          computed: r.um,
        };
        row++;
      });

      // Empty separator row between sections
      row++;
    });

    return cells;
  };

  const createBomSummarySheet = async () => {
    if (!element.sapReference) {
      console.error("[BOM] element.sapReference is not set", element);
      alert("Este elemento no tiene referencia SAP configurada. No se puede generar el BOM.");
      return;
    }

    let result: Awaited<ReturnType<typeof triggerGetBom>>;
    try {
      result = await triggerGetBom(element.sapReference);
    } catch (err) {
      console.error("[BOM] triggerGetBom threw:", err);
      alert("Error al consultar la estructura BOM. Revisa la consola para más detalles.");
      return;
    }

    if (!result.data) {
      console.error("[BOM] No data returned. error:", result.error, "sapReference:", element.sapReference);
      alert(`No se encontró estructura BOM para la referencia SAP: ${element.sapReference}`);
      return;
    }

    let cells: { [key: string]: Cell };
    try {
      bomDataRef.current = result.data;
      setBomExpandedChildNodes(new Set());
      cells = buildBomSummaryCells(result.data, new Set());
    } catch (err) {
      console.error("[BOM] buildBomSummaryCells threw:", err);
      alert("Error al construir la hoja BOM. Revisa la consola para más detalles.");
      return;
    }

    const bomSheet: Sheet = {
      id: `${instanceId}-bom${Date.now()}`,
      name: "Resumen BOM",
      cells,
      // A=ID, B=item, C=descripción (wide), D=cantidad, E=U.M.
      columnWidths: { 0: 80, 1: 90, 2: 280, 3: 90, 4: 70 },
      rowHeights: {},
      templateHiddenRows: new Set<number>(),
      templateHiddenColumns: new Set<number>(),
      userHiddenRows: new Set<number>(),
      userHiddenColumns: new Set<number>(),
      hiddenCells: new Set<string>(),
      freezeRow: 0,
      freezeColumn: 0,
      mergedCells: [],
      isBomSummary: true,
    };
    setSheets((prev) => [...prev, bomSheet]);
    setActiveSheetId(bomSheet.id);
  };

  // Toggle expand/collapse of a child SF node in the BOM summary sheet.
  // Rebuilds the sheet cells immediately using the cached BOM data.
  const toggleBomNode = (nodeId: number) => {
    const next = new Set(bomExpandedChildNodes);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    setBomExpandedChildNodes(next);
    if (bomDataRef.current) {
      const freshCells = buildBomSummaryCells(bomDataRef.current, next);
      setSheets((prev) =>
        prev.map((s) =>
          s.id === activeSheetId ? { ...s, cells: freshCells } : s,
        ),
      );
    }
  };

  // Switch to sheet
  const switchToSheet = (sheetId: string) => {
    setActiveSheetId(sheetId);

    // Auto-refresh the BOM summary sheet whenever the user switches to it,
    // so it always reflects the latest values from source sheets.
    const target = sheets.find((s) => s.id === sheetId);
    if (target?.isBomSummary && element.sapReference) {
      triggerGetBom(element.sapReference).then((result) => {
        if (!result.data) return;
        bomDataRef.current = result.data;
        const freshCells = buildBomSummaryCells(result.data, bomExpandedChildNodes);
        setSheets((prev) =>
          prev.map((s) =>
            s.id === sheetId ? { ...s, cells: freshCells } : s
          )
        );
      });
    }

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

  // --- GoTo Navigation ---
  // Navigate to the named range that matches the condition cell values for the given cell's goTo config
  const navigateGoTo = useCallback(
    (cellRef: string) => {
      const cell = cells[cellRef];
      if (!cell?.goTo) return;

      // Read values from condition cells (from current sheet)
      const conditionValues = cell.goTo.conditionCells.map((ref) => {
        const c = cells[ref];
        const val = c?.computed ?? c?.value ?? "";
        return String(val).trim().toLowerCase();
      });

      // Search all sheets for a named range whose tags match ALL condition values
      for (const sheet of sheets) {
        const ranges = sheet.namedRanges || [];
        for (const range of ranges) {
          const rangeTags = range.tags.map((t) => t.trim().toLowerCase());
          const allMatch = conditionValues.every((v) => rangeTags.includes(v));
          if (allMatch && conditionValues.length > 0) {
            const targetCell = range.startCell;
            const isCrossSheet = sheet.id !== activeSheetId;

            if (isCrossSheet) {
              // Switch sheet first — this resets selection, so we override after
              setActiveSheetId(sheet.id);
            }

            // Set selection to target cell (must happen after setActiveSheetId)
            setSelectedCell(targetCell);
            selectionAnchorRef.current = targetCell;
            setSelectedCells(new Set([targetCell]));
            setFormulaInput("");
            setIsAddingToFormula(false);
            setRangeSelectionStart(null);

            // For cross-sheet, use a longer delay so the new sheet grid has time to mount
            const delay = isCrossSheet ? 300 : 100;
            setTimeout(() => {
              if (scrollToCellRef.current) {
                scrollToCellRef.current(targetCell);
              }
              // Trigger highlight animation after scroll
              setTimeout(() => {
                setGoToHighlight(targetCell);
                setTimeout(() => setGoToHighlight(null), 1500);
              }, 350);
            }, delay);
            return;
          }
        }
      }
      // No match found - alert user
      alert(
        `No se encontró una tabla que coincida con las condiciones: ${conditionValues.join(", ")}`,
      );
    },
    [cells, sheets, activeSheetId],
  );

  // Save GoTo config to a cell
  const saveGoToConfig = useCallback(
    (cellRef: string, conditionCells: string[]) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          const updatedCells = { ...sheet.cells };
          updatedCells[cellRef] = {
            ...updatedCells[cellRef],
            goTo: conditionCells.length > 0 ? { conditionCells } : undefined,
          };
          return { ...sheet, cells: updatedCells };
        }),
      );
    },
    [activeSheetId, setSheets],
  );

  // Add/update a named range on the active sheet
  const saveNamedRange = useCallback(
    (range: NamedRange) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          const existing = sheet.namedRanges || [];
          const idx = existing.findIndex((r) => r.id === range.id);
          const updated =
            idx >= 0
              ? existing.map((r) => (r.id === range.id ? range : r))
              : [...existing, range];
          return { ...sheet, namedRanges: updated };
        }),
      );
    },
    [activeSheetId, setSheets],
  );

  // Delete a named range from the active sheet
  const deleteNamedRange = useCallback(
    (rangeId: string) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          return {
            ...sheet,
            namedRanges: (sheet.namedRanges || []).filter(
              (r) => r.id !== rangeId,
            ),
          };
        }),
      );
    },
    [activeSheetId, setSheets],
  );

  // Save / update a semi-finished zone on the active sheet.
  // Overlapping cells are reassigned to the new zone (one zone per cell).
  const saveSemiFinishedZone = useCallback(
    (zone: SemiFinishedZone) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          const existing = sheet.semiFinishedZones || [];
          const newStart = parseCellRef(zone.startCell);
          const newEnd = parseCellRef(zone.endCell);
          if (!newStart || !newEnd) return sheet;
          const newMinRow = Math.min(newStart.row, newEnd.row);
          const newMaxRow = Math.max(newStart.row, newEnd.row);
          const newMinCol = Math.min(newStart.col, newEnd.col);
          const newMaxCol = Math.max(newStart.col, newEnd.col);

          const rectsOverlap = (other: SemiFinishedZone) => {
            if (other.id === zone.id) return false;
            const os = parseCellRef(other.startCell);
            const oe = parseCellRef(other.endCell);
            if (!os || !oe) return false;
            const oMinRow = Math.min(os.row, oe.row);
            const oMaxRow = Math.max(os.row, oe.row);
            const oMinCol = Math.min(os.col, oe.col);
            const oMaxCol = Math.max(os.col, oe.col);
            return !(
              newMaxRow < oMinRow ||
              newMinRow > oMaxRow ||
              newMaxCol < oMinCol ||
              newMinCol > oMaxCol
            );
          };

          const withoutOverlaps = existing.filter((z) => !rectsOverlap(z));
          const idx = withoutOverlaps.findIndex((z) => z.id === zone.id);
          const updated =
            idx >= 0
              ? withoutOverlaps.map((z) => (z.id === zone.id ? zone : z))
              : [...withoutOverlaps, zone];
          return { ...sheet, semiFinishedZones: updated };
        }),
      );
    },
    [activeSheetId, setSheets],
  );

  const deleteSemiFinishedZone = useCallback(
    (zoneId: string) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          return {
            ...sheet,
            semiFinishedZones: (sheet.semiFinishedZones || []).filter(
              (z) => z.id !== zoneId,
            ),
          };
        }),
      );
    },
    [activeSheetId, setSheets],
  );

  // Save / update an item catalog table on the active sheet. Overlapping tables
  // on the same sheet are not allowed; the new one replaces any overlap so the
  // catalogCellMap stays unambiguous (one cell -> one catalog).
  const saveItemCatalogTable = useCallback(
    (table: ItemCatalogTable) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          const existing = sheet.itemCatalogTables || [];
          const newStart = parseCellRef(table.startCell);
          const newEnd = parseCellRef(table.endCell);
          if (!newStart || !newEnd) return sheet;
          const newMinRow = Math.min(newStart.row, newEnd.row);
          const newMaxRow = Math.max(newStart.row, newEnd.row);
          const newMinCol = Math.min(newStart.col, newEnd.col);
          const newMaxCol = Math.max(newStart.col, newEnd.col);

          const rectsOverlap = (other: ItemCatalogTable) => {
            if (other.id === table.id) return false;
            const os = parseCellRef(other.startCell);
            const oe = parseCellRef(other.endCell);
            if (!os || !oe) return false;
            const oMinRow = Math.min(os.row, oe.row);
            const oMaxRow = Math.max(os.row, oe.row);
            const oMinCol = Math.min(os.col, oe.col);
            const oMaxCol = Math.max(os.col, oe.col);
            return !(
              newMaxRow < oMinRow ||
              newMinRow > oMaxRow ||
              newMaxCol < oMinCol ||
              newMinCol > oMaxCol
            );
          };

          const withoutOverlaps = existing.filter((t) => !rectsOverlap(t));
          const idx = withoutOverlaps.findIndex((t) => t.id === table.id);
          const updated =
            idx >= 0
              ? withoutOverlaps.map((t) => (t.id === table.id ? table : t))
              : [...withoutOverlaps, table];
          return { ...sheet, itemCatalogTables: updated };
        }),
      );
    },
    [activeSheetId, setSheets],
  );

  const deleteItemCatalogTable = useCallback(
    (tableId: string) => {
      setSheets((prevSheets) =>
        prevSheets.map((sheet) => {
          if (sheet.id !== activeSheetId) return sheet;
          return {
            ...sheet,
            itemCatalogTables: (sheet.itemCatalogTables || []).filter(
              (t) => t.id !== tableId,
            ),
          };
        }),
      );
    },
    [activeSheetId, setSheets],
  );

  // Write or clear the itemLink on a specific cell of a specific sheet.
  // Passing null clears the link.
  const setCellItemLink = useCallback(
    (sheetId: string, cellRef: string, link: CellItemLink | null) => {
      setSheets((prev) =>
        prev.map((s) => {
          if (s.id !== sheetId) return s;
          const cells = { ...s.cells };
          const existing: Cell = cells[cellRef] || {
            value: "",
            formula: "",
            computed: "",
          };
          if (link === null) {
            const { itemLink: _omit, ...rest } = existing;
            cells[cellRef] = rest as Cell;
          } else {
            cells[cellRef] = { ...existing, itemLink: link };
          }
          return { ...s, cells };
        }),
      );
    },
    [setSheets],
  );

  // Set or clear `catalogConditionCells` on a cell. The list of cellRefs is
  // matched (by computed value) against catalog tags to auto-route the picker.
  const setCellCatalogConditionCells = useCallback(
    (sheetId: string, cellRef: string, conditionCells: string[] | null) => {
      setSheets((prev) =>
        prev.map((s) => {
          if (s.id !== sheetId) return s;
          const cells = { ...s.cells };
          const existing: Cell = cells[cellRef] || {
            value: "",
            formula: "",
            computed: "",
          };
          if (!conditionCells || conditionCells.length === 0) {
            const { catalogConditionCells: _omit, ...rest } = existing;
            cells[cellRef] = rest as Cell;
          } else {
            cells[cellRef] = { ...existing, catalogConditionCells: conditionCells };
          }
          return { ...s, cells };
        }),
      );
    },
    [setSheets],
  );

  // Read the user-visible value of a cell, preferring the computed result.
  // Used by the picker to extract the item ID from the catalog ID column.
  const readCellDisplayValue = useCallback((c: Cell | undefined): string => {
    if (!c) return "";
    const computed =
      c.computed !== undefined && c.computed !== null && c.computed !== ""
        ? c.computed
        : null;
    if (computed !== null) return String(computed).trim();
    return (c.value || "").trim();
  }, []);

  // Open the picker modal for a specific cell. Filtering by tags happens in
  // the memo below; here we just record which cell triggered the picker.
  const openItemPickerForCell = useCallback(
    (sourceCellRef: string) => {
      setItemPickerModal({
        isOpen: true,
        sourceCellRef,
        sourceSheetId: activeSheetId,
        showAll: false,
      });
    },
    [activeSheetId],
  );

  const closeItemPickerModal = useCallback(() => {
    setItemPickerModal({
      isOpen: false,
      sourceCellRef: null,
      sourceSheetId: null,
      showAll: false,
    });
  }, []);

  // Workbook-wide resolver: catalogTableId -> { sheetId, table, itemsById }.
  // Each catalog table is indexed by item ID so itemLink lookups are O(1) and
  // edits to the catalog row's description / U.M. propagate automatically.
  const catalogResolver = useMemo(() => {
    const tables = new Map<
      string,
      {
        sheetId: string;
        sheetName: string;
        table: ItemCatalogTable;
        itemsById: Map<string, { description: string; um: string }>;
      }
    >();
    sheets.forEach((sheet) => {
      (sheet.itemCatalogTables || []).forEach((table) => {
        const start = parseCellRef(table.startCell);
        const end = parseCellRef(table.endCell);
        if (!start || !end) return;
        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        const minCol = Math.min(start.col, end.col);
        const itemsById = new Map<
          string,
          { description: string; um: string }
        >();
        const dataStart = minRow + table.headerRows;
        for (let r = dataStart; r <= maxRow; r++) {
          const idRef = `${getColumnLabel(minCol + table.idColumnOffset)}${r + 1}`;
          const descRef = `${getColumnLabel(minCol + table.descriptionColumnOffset)}${r + 1}`;
          const umRef = `${getColumnLabel(minCol + table.umColumnOffset)}${r + 1}`;
          const itemId = readCellDisplayValue(sheet.cells[idRef]);
          if (!itemId) continue;
          itemsById.set(itemId, {
            description: readCellDisplayValue(sheet.cells[descRef]),
            um: readCellDisplayValue(sheet.cells[umRef]),
          });
        }
        tables.set(table.id, {
          sheetId: sheet.id,
          sheetName: sheet.name,
          table,
          itemsById,
        });
      });
    });
    return tables;
  }, [sheets, readCellDisplayValue]);

  // Map cellRef -> resolved item info for the active sheet only.
  // orphan=true when the catalog table or the item ID no longer exists, so the
  // badge can flag stale links instead of silently hiding them.
  const cellItemLinkMap = useMemo(() => {
    const map = new Map<
      string,
      {
        itemId: string;
        description: string;
        um: string;
        orphan: boolean;
      }
    >();
    if (!currentSheet) return map;
    for (const ref of Object.keys(currentSheet.cells)) {
      const link = currentSheet.cells[ref]?.itemLink;
      if (!link) continue;
      const table = catalogResolver.get(link.catalogTableId);
      if (!table) {
        map.set(ref, {
          itemId: link.itemId,
          description: "",
          um: "",
          orphan: true,
        });
        continue;
      }
      const row = table.itemsById.get(link.itemId);
      if (!row) {
        map.set(ref, {
          itemId: link.itemId,
          description: "",
          um: "",
          orphan: true,
        });
        continue;
      }
      map.set(ref, {
        itemId: link.itemId,
        description: row.description,
        um: row.um,
        orphan: false,
      });
    }
    return map;
  }, [currentSheet, catalogResolver]);

  // Build the catalogs list to show in ItemPickerModal. Filtering rule:
  // 1. Read the source cell's catalogConditionCells; resolve each ref to its
  //    computed display value (lowercased, trimmed).
  // 2. Keep catalogs whose `tags` array contains ALL condition values (AND).
  // 3. If `showAll` is true, or no condition values were configured, or no
  //    catalog matched, fall back to every catalog in the workbook.
  const itemPickerCatalogs = useMemo(() => {
    const allEntries: CatalogEntry[] = [];
    catalogResolver.forEach((entry) => {
      const rows: Array<{
        itemId: string;
        description: string;
        um: string;
      }> = [];
      entry.itemsById.forEach((row, itemId) => {
        rows.push({ itemId, description: row.description, um: row.um });
      });
      allEntries.push({
        table: entry.table,
        sheetId: entry.sheetId,
        sheetName: entry.sheetName,
        rows,
      });
    });

    if (!itemPickerModal.isOpen) {
      return { entries: allEntries, filteredByConditions: false };
    }

    if (itemPickerModal.showAll) {
      return { entries: allEntries, filteredByConditions: false };
    }

    const sourceSheet = sheets.find(
      (s) => s.id === itemPickerModal.sourceSheetId,
    );
    const conditionCells =
      sourceSheet?.cells[itemPickerModal.sourceCellRef ?? ""]
        ?.catalogConditionCells;
    if (!conditionCells || conditionCells.length === 0) {
      return { entries: allEntries, filteredByConditions: false };
    }

    const requiredTags = conditionCells
      .map((ref) => readCellDisplayValue(sourceSheet?.cells[ref]).toLowerCase())
      .filter((v) => v.length > 0);
    if (requiredTags.length === 0) {
      return { entries: allEntries, filteredByConditions: false };
    }

    const filtered = allEntries.filter((e) => {
      const tags = (e.table.tags || []).map((t) => t.toLowerCase());
      return requiredTags.every((rt) => tags.includes(rt));
    });

    if (filtered.length === 0) {
      // No catalog matched the conditions — be permissive and show all,
      // marked as "no match" so the modal can surface a hint.
      return { entries: allEntries, filteredByConditions: false };
    }

    return { entries: filtered, filteredByConditions: true };
  }, [
    catalogResolver,
    itemPickerModal.isOpen,
    itemPickerModal.showAll,
    itemPickerModal.sourceSheetId,
    itemPickerModal.sourceCellRef,
    sheets,
    readCellDisplayValue,
  ]);

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
            namedRanges: templateSheet.cellsStyles.namedRanges || [],
            semiFinishedZones:
              templateSheet.cellsStyles.semiFinishedZones || [],
            itemCatalogTables:
              templateSheet.cellsStyles.itemCatalogTables || [],
          };
        });

        // Recalculate all formulas for all sheets using dep graph
        const recalculateAllSheetsFormulas = async () => {
          const updatedSheets: Sheet[] = [];

          for (const sheet of newSheets) {
            const newCells = { ...sheet.cells };
            const updatedComputedValues: Record<string, string | number> = {};

            // Build dependency graph and get topological order
            buildGraph(newCells);
            const formulaCells = Object.keys(newCells).filter((ref) =>
              newCells[ref]?.formula?.startsWith("="),
            );
            const { order, circular } = getRecalcOrder(formulaCells);

            // Mark circular references
            circular.forEach((ref) => {
              updatedComputedValues[ref] = "#CIRCULAR";
              newCells[ref] = { ...newCells[ref], computed: "#CIRCULAR" };
            });

            // Process non-formula cells first
            for (const ref of Object.keys(newCells)) {
              if (!newCells[ref]?.formula?.startsWith("=")) {
                try {
                  const result = await evaluateFormula(
                    newCells[ref].formula,
                    newCells,
                    newSheets,
                  );
                  updatedComputedValues[ref] =
                    result !== undefined ? result : "";
                  newCells[ref] = {
                    ...newCells[ref],
                    computed: updatedComputedValues[ref],
                  };
                } catch {
                  // Plain values shouldn't error
                }
              }
            }

            // Process formula cells in topological order
            for (const ref of order) {
              if (!newCells[ref]?.formula?.startsWith("=")) continue;
              try {
                const result = await evaluateFormula(
                  newCells[ref].formula,
                  newCells,
                  newSheets,
                );
                updatedComputedValues[ref] = result !== undefined ? result : "";
                newCells[ref] = {
                  ...newCells[ref],
                  computed: updatedComputedValues[ref],
                };
              } catch (error) {
                console.error(`Error calculating cell ${ref}:`, error);
                updatedComputedValues[ref] = "#ERROR";
                newCells[ref] = { ...newCells[ref], computed: "#ERROR" };
              }
            }

            updatedSheets.push({ ...sheet, cells: newCells });
          }

          // Update all sheets with recalculated formulas
          setSheets(updatedSheets);

          // Set active sheet to the first sheet
          if (updatedSheets[0]?.id) {
            setActiveSheetId(updatedSheets[0].id);
            // Rebuild graph for the active (first) sheet so edits work immediately
            buildGraph(updatedSheets[0].cells);
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
              namedRanges: template.cellsStyles?.namedRanges || [],
              semiFinishedZones:
                template.cellsStyles?.semiFinishedZones || [],
              itemCatalogTables:
                template.cellsStyles?.itemCatalogTables || [],
            };
          }
          return sheet;
        });

        // After loading template, recalculate all formulas using dep graph
        const recalculateAllTemplateFormulas = async () => {
          const currentSheet = updatedSheets.find(
            (sheet) => sheet.id === activeSheetId,
          );
          if (!currentSheet) return;

          const newCells = { ...currentSheet.cells };
          const updatedComputedValues: Record<string, string | number> = {};

          // Build dependency graph and get topological order
          buildGraph(newCells);
          const formulaCells = Object.keys(newCells).filter((ref) =>
            newCells[ref]?.formula?.startsWith("="),
          );
          const { order, circular } = getRecalcOrder(formulaCells);

          // Mark circular references
          circular.forEach((ref) => {
            updatedComputedValues[ref] = "#CIRCULAR";
            newCells[ref] = { ...newCells[ref], computed: "#CIRCULAR" };
          });

          // Process non-formula cells first
          for (const ref of Object.keys(newCells)) {
            if (!newCells[ref]?.formula?.startsWith("=")) {
              try {
                const result = await evaluateFormula(
                  newCells[ref].formula,
                  newCells,
                  updatedSheets,
                );
                updatedComputedValues[ref] = result !== undefined ? result : "";
                newCells[ref] = {
                  ...newCells[ref],
                  computed: updatedComputedValues[ref],
                };
              } catch {
                // Plain values shouldn't error
              }
            }
          }

          // Process formula cells in topological order
          for (const ref of order) {
            if (!newCells[ref]?.formula?.startsWith("=")) continue;
            try {
              const result = await evaluateFormula(
                newCells[ref].formula,
                newCells,
                updatedSheets,
              );
              updatedComputedValues[ref] = result !== undefined ? result : "";
              newCells[ref] = {
                ...newCells[ref],
                computed: updatedComputedValues[ref],
              };
            } catch (error) {
              console.error(`Error calculating cell ${ref}:`, error);
              updatedComputedValues[ref] = "#ERROR";
              newCells[ref] = { ...newCells[ref], computed: "#ERROR" };
            }
          }

          // Apply all the computed values at once
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

          // Rebuild graph for the active sheet so edits work immediately
          buildGraph(newCells);
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
    [
      activeSheetId,
      evaluateFormula,
      element.values,
      instanceId,
      buildGraph,
      getRecalcOrder,
    ],
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
      <style>{`
        @keyframes goToHighlightPulse {
          0% { box-shadow: inset 0 0 0 3px #3b82f6, 0 0 0 0 rgba(59,130,246,0.7); }
          25% { box-shadow: inset 0 0 0 3px #3b82f6, 0 0 0 12px rgba(59,130,246,0); }
          50% { box-shadow: inset 0 0 0 3px #3b82f6, 0 0 0 0 rgba(59,130,246,0.5); }
          75% { box-shadow: inset 0 0 0 3px #3b82f6, 0 0 0 8px rgba(59,130,246,0); }
          100% { box-shadow: inset 0 0 0 0px transparent, 0 0 0 0 transparent; }
        }
        .goto-highlight-cell {
          animation: goToHighlightPulse 1.5s ease-out forwards;
          z-index: 35 !important;
          position: relative;
        }
      `}</style>
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
        namedRangeStartCells={namedRangeStartCells}
        cellZoneMap={cellZoneMap}
        catalogCellMap={catalogCellMap}
        cellItemLinkMap={cellItemLinkMap}
        goToHighlightCell={goToHighlight}
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
            className="fixed bg-white border border-gray-300 shadow-lg rounded z-50 overflow-y-auto"
            ref={(el) => {
              if (!el) return;
              // Flip / clamp so the menu stays inside the viewport
              const rect = el.getBoundingClientRect();
              const margin = 8;
              const vw = window.innerWidth;
              const vh = window.innerHeight;
              let nextLeft = contextMenu.x;
              let nextTop = contextMenu.y;
              if (rect.right > vw - margin) {
                nextLeft = Math.max(margin, vw - rect.width - margin);
              }
              if (rect.bottom > vh - margin) {
                nextTop = Math.max(margin, vh - rect.height - margin);
              }
              if (
                Math.round(rect.left) !== Math.round(nextLeft) ||
                Math.round(rect.top) !== Math.round(nextTop)
              ) {
                el.style.left = `${nextLeft}px`;
                el.style.top = `${nextTop}px`;
              }
            }}
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
              maxHeight: "85vh",
            }}
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
                    <div className="border-t my-1"></div>
                    {/* Etiquetado de celda para el código de diseño (MO / material de devanado) */}
                    {(() => {
                      const currentTag =
                        currentSheet?.cells[contextMenu.cellRef!]?.materialTag;
                      return (
                        <>
                          <button
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                            disabled={currentTag === "MO"}
                            onClick={() =>
                              tagCellAsMaterial(contextMenu.cellRef!, "MO")
                            }
                          >
                            🏷️{" "}
                            {currentTag === "MO"
                              ? "Celda etiquetada como MO"
                              : "Etiquetar celda como MO"}
                          </button>
                          <button
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                            disabled={currentTag === "MD"}
                            onClick={() =>
                              tagCellAsMaterial(contextMenu.cellRef!, "MD")
                            }
                          >
                            🏷️{" "}
                            {currentTag === "MD"
                              ? "Celda etiquetada como Material de Devanado"
                              : "Etiquetar celda como Material de Devanado (MD)"}
                          </button>
                          {currentTag && (
                            <button
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm text-red-600"
                              onClick={() =>
                                clearCellMaterialTag(contextMenu.cellRef!)
                              }
                            >
                              🗑️ Quitar etiqueta {currentTag}
                            </button>
                          )}
                        </>
                      );
                    })()}
                    <div className="border-t my-1"></div>
                    {/* GoTo: navigate to linked table */}
                    {currentSheet?.cells[contextMenu.cellRef!]?.goTo && (
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm text-blue-600 font-medium"
                        onClick={() => {
                          navigateGoTo(contextMenu.cellRef!);
                          setContextMenu({
                            visible: false,
                            x: 0,
                            y: 0,
                            type: null,
                            index: -1,
                          });
                        }}
                      >
                        🔗 Ir a tabla
                      </button>
                    )}
                    {/* Configure GoTo on this cell */}
                    <button
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                      onClick={() => {
                        const existing =
                          currentSheet?.cells[contextMenu.cellRef!]?.goTo;
                        setGoToConfigModal({
                          visible: true,
                          cellRef: contextMenu.cellRef!,
                          conditionCells: existing
                            ? existing.conditionCells.join(", ")
                            : "",
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
                      🎯{" "}
                      {currentSheet?.cells[contextMenu.cellRef!]?.goTo
                        ? "Editar Ir a..."
                        : "Configurar Ir a..."}
                    </button>
                    {currentSheet?.cells[contextMenu.cellRef!]?.goTo && (
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm text-red-600"
                        onClick={() => {
                          saveGoToConfig(contextMenu.cellRef!, []);
                          setContextMenu({
                            visible: false,
                            x: 0,
                            y: 0,
                            type: null,
                            index: -1,
                          });
                        }}
                      >
                        🗑️ Quitar Ir a
                      </button>
                    )}
                    <div className="border-t my-1"></div>
                    {/* Named Range: label selection as a table */}
                    <button
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                      onClick={() => {
                        // Pre-fill with selection range
                        const coords: { col: number; row: number }[] = [];
                        selectedCells.forEach((ref) => {
                          const pos = parseCellRef(ref);
                          if (pos) coords.push(pos);
                        });
                        let startCell = contextMenu.cellRef!;
                        let endCell = contextMenu.cellRef!;
                        if (coords.length > 1) {
                          const minCol = Math.min(...coords.map((c) => c.col));
                          const maxCol = Math.max(...coords.map((c) => c.col));
                          const minRow = Math.min(...coords.map((c) => c.row));
                          const maxRow = Math.max(...coords.map((c) => c.row));
                          startCell = `${getColumnLabel(minCol)}${minRow + 1}`;
                          endCell = `${getColumnLabel(maxCol)}${maxRow + 1}`;
                        }
                        setNamedRangeModal({
                          visible: true,
                          editId: null,
                          name: "",
                          tags: "",
                          startCell,
                          endCell,
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
                      📋 Etiquetar rango como tabla
                    </button>
                    {(currentSheet?.namedRanges || []).length > 0 && (
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        onClick={() => {
                          // Show a simple list - open modal with first range for editing
                          const ranges = currentSheet?.namedRanges || [];
                          if (ranges.length > 0) {
                            const r = ranges[0];
                            setNamedRangeModal({
                              visible: true,
                              editId: r.id,
                              name: r.name,
                              tags: r.tags.join(", "),
                              startCell: r.startCell,
                              endCell: r.endCell,
                            });
                          }
                          setContextMenu({
                            visible: false,
                            x: 0,
                            y: 0,
                            type: null,
                            index: -1,
                          });
                        }}
                      >
                        📑 Ver tablas etiquetadas (
                        {(currentSheet?.namedRanges || []).length})
                      </button>
                    )}
                    <div className="border-t my-1"></div>
                    {/* Semi-finished zone: assign selection to a semi-finished product */}
                    {(() => {
                      const existingZone = (
                        currentSheet?.semiFinishedZones || []
                      ).find((z) => {
                        const s = parseCellRef(z.startCell);
                        const e = parseCellRef(z.endCell);
                        const cur = parseCellRef(contextMenu.cellRef!);
                        if (!s || !e || !cur) return false;
                        const minR = Math.min(s.row, e.row);
                        const maxR = Math.max(s.row, e.row);
                        const minC = Math.min(s.col, e.col);
                        const maxC = Math.max(s.col, e.col);
                        return (
                          cur.row >= minR &&
                          cur.row <= maxR &&
                          cur.col >= minC &&
                          cur.col <= maxC
                        );
                      });
                      return (
                        <>
                          <button
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                            onClick={() => {
                              const coords: {
                                col: number;
                                row: number;
                              }[] = [];
                              selectedCells.forEach((ref) => {
                                const pos = parseCellRef(ref);
                                if (pos) coords.push(pos);
                              });
                              let startCell = contextMenu.cellRef!;
                              let endCell = contextMenu.cellRef!;
                              if (coords.length > 1) {
                                const minCol = Math.min(
                                  ...coords.map((c) => c.col),
                                );
                                const maxCol = Math.max(
                                  ...coords.map((c) => c.col),
                                );
                                const minRow = Math.min(
                                  ...coords.map((c) => c.row),
                                );
                                const maxRow = Math.max(
                                  ...coords.map((c) => c.row),
                                );
                                startCell = `${getColumnLabel(minCol)}${minRow + 1}`;
                                endCell = `${getColumnLabel(maxCol)}${maxRow + 1}`;
                              }
                              setSemiFinishedZoneModal({
                                visible: true,
                                editId: existingZone?.id || null,
                                semiFinishedId:
                                  existingZone?.semiFinishedId ?? null,
                                startCell:
                                  existingZone?.startCell || startCell,
                                endCell: existingZone?.endCell || endCell,
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
                            🏷️{" "}
                            {existingZone
                              ? `Editar zona (${existingZone.semiFinishedCode})`
                              : "Asignar zona a semi-terminado"}
                          </button>
                          {existingZone && (
                            <button
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm text-red-600"
                              onClick={() => {
                                deleteSemiFinishedZone(existingZone.id);
                                setContextMenu({
                                  visible: false,
                                  x: 0,
                                  y: 0,
                                  type: null,
                                  index: -1,
                                });
                              }}
                            >
                              🗑️ Quitar zona
                            </button>
                          )}
                        </>
                      );
                    })()}
                    <div className="border-t my-1"></div>
                    {/* Item catalog table: mark selection as catalog source */}
                    {(() => {
                      const existingTable = (
                        currentSheet?.itemCatalogTables || []
                      ).find((t) => {
                        const s = parseCellRef(t.startCell);
                        const e = parseCellRef(t.endCell);
                        const cur = parseCellRef(contextMenu.cellRef!);
                        if (!s || !e || !cur) return false;
                        const minR = Math.min(s.row, e.row);
                        const maxR = Math.max(s.row, e.row);
                        const minC = Math.min(s.col, e.col);
                        const maxC = Math.max(s.col, e.col);
                        return (
                          cur.row >= minR &&
                          cur.row <= maxR &&
                          cur.col >= minC &&
                          cur.col <= maxC
                        );
                      });
                      return (
                        <>
                          <button
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                            onClick={() => {
                              const coords: {
                                col: number;
                                row: number;
                              }[] = [];
                              selectedCells.forEach((ref) => {
                                const pos = parseCellRef(ref);
                                if (pos) coords.push(pos);
                              });
                              let startCell = contextMenu.cellRef!;
                              let endCell = contextMenu.cellRef!;
                              if (coords.length > 1) {
                                const minCol = Math.min(
                                  ...coords.map((c) => c.col),
                                );
                                const maxCol = Math.max(
                                  ...coords.map((c) => c.col),
                                );
                                const minRow = Math.min(
                                  ...coords.map((c) => c.row),
                                );
                                const maxRow = Math.max(
                                  ...coords.map((c) => c.row),
                                );
                                startCell = `${getColumnLabel(minCol)}${minRow + 1}`;
                                endCell = `${getColumnLabel(maxCol)}${maxRow + 1}`;
                              }
                              setCatalogTableModal({
                                visible: true,
                                editId: existingTable?.id || null,
                                name: existingTable?.name || "",
                                tagsInput: (existingTable?.tags || []).join(", "),
                                startCell:
                                  existingTable?.startCell || startCell,
                                endCell: existingTable?.endCell || endCell,
                                headerRows: existingTable?.headerRows ?? 1,
                                idColumnOffset:
                                  existingTable?.idColumnOffset ?? 0,
                                descriptionColumnOffset:
                                  existingTable?.descriptionColumnOffset ?? 1,
                                umColumnOffset:
                                  existingTable?.umColumnOffset ?? 2,
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
                            📚{" "}
                            {existingTable
                              ? `Editar tabla catálogo (${existingTable.name})`
                              : "Marcar como tabla de catálogo"}
                          </button>
                          {existingTable && (
                            <button
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm text-red-600"
                              onClick={() => {
                                deleteItemCatalogTable(existingTable.id);
                                setContextMenu({
                                  visible: false,
                                  x: 0,
                                  y: 0,
                                  type: null,
                                  index: -1,
                                });
                              }}
                            >
                              🗑️ Quitar tabla catálogo
                            </button>
                          )}
                        </>
                      );
                    })()}
                    <div className="border-t my-1"></div>
                    {/* Item link: bind / edit / clear the catalog item for this cell */}
                    {(() => {
                      const ref = contextMenu.cellRef!;
                      const existingLink = currentSheet?.cells[ref]?.itemLink;
                      return (
                        <>
                          <button
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                            onClick={() => {
                              openItemPickerForCell(ref);
                              setContextMenu({
                                visible: false,
                                x: 0,
                                y: 0,
                                type: null,
                                index: -1,
                              });
                            }}
                          >
                            🔗{" "}
                            {existingLink
                              ? `Cambiar vínculo (#${existingLink.itemId})`
                              : "Vincular a item del catálogo"}
                          </button>
                          {existingLink && (
                            <button
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm text-red-600"
                              onClick={() => {
                                setCellItemLink(activeSheetId, ref, null);
                                setContextMenu({
                                  visible: false,
                                  x: 0,
                                  y: 0,
                                  type: null,
                                  index: -1,
                                });
                              }}
                            >
                              ❌ Quitar vínculo
                            </button>
                          )}
                          {/* Configure which condition cells route this cell
                              to the right catalog (tags match against values). */}
                          <button
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm text-gray-600"
                            onClick={() => {
                              const existing =
                                currentSheet?.cells[ref]
                                  ?.catalogConditionCells || [];
                              setCatalogConditionModal({
                                visible: true,
                                cellRef: ref,
                                conditionCellsInput: existing.join(", "),
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
                            ⚙️ Configurar vínculo al catálogo
                            {(currentSheet?.cells[ref]
                              ?.catalogConditionCells?.length ?? 0) > 0 && (
                              <span className="text-xs text-cyan-600 ml-1">
                                (
                                {
                                  currentSheet?.cells[ref]
                                    ?.catalogConditionCells?.length
                                }
                                )
                              </span>
                            )}
                          </button>
                        </>
                      );
                    })()}
                  </>
                );
              })()}
          </div>
        </>
      )}

      {/* Catalog Condition Cells Modal */}
      {catalogConditionModal.visible && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-50"
            onClick={() =>
              setCatalogConditionModal({
                visible: false,
                cellRef: null,
                conditionCellsInput: "",
              })
            }
          />
          <div
            className="fixed z-50 bg-white border border-gray-300 shadow-xl rounded-lg p-4 w-[28rem]"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                ⚙️ Configurar vínculo al catálogo ·{" "}
                <span className="font-mono">
                  {catalogConditionModal.cellRef}
                </span>
              </h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() =>
                  setCatalogConditionModal({
                    visible: false,
                    cellRef: null,
                    conditionCellsInput: "",
                  })
                }
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Indica qué celdas se leen como condición. Sus valores se comparan
              contra los <strong>tags</strong> de los catálogos. Al vincular,
              el modal abre directamente la tabla cuyos tags coinciden.
              <br />
              <span className="text-gray-400">
                Si no defines condiciones, el modal mostrará todos los
                catálogos.
              </span>
            </p>
            <label className="text-xs text-gray-500 block mb-1">
              Celdas de condición{" "}
              <span className="text-gray-400 font-normal">
                (separadas por coma, ej: B5, B6)
              </span>
            </label>
            <input
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
              value={catalogConditionModal.conditionCellsInput}
              onChange={(e) =>
                setCatalogConditionModal((prev) => ({
                  ...prev,
                  conditionCellsInput: e.target.value.toUpperCase(),
                }))
              }
              placeholder="B5, B6"
            />
            {catalogConditionModal.cellRef &&
              (() => {
                const refs = catalogConditionModal.conditionCellsInput
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0);
                if (refs.length === 0) return null;
                return (
                  <div className="mt-3 text-xs bg-gray-50 border border-gray-200 rounded p-2">
                    <div className="text-gray-500 font-semibold mb-1">
                      Valores actuales:
                    </div>
                    {refs.map((r) => (
                      <div key={r} className="font-mono text-gray-700">
                        {r} ={" "}
                        <span className="text-cyan-700">
                          "{readCellDisplayValue(currentSheet?.cells[r])}"
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
                onClick={() => {
                  if (catalogConditionModal.cellRef) {
                    setCellCatalogConditionCells(
                      activeSheetId,
                      catalogConditionModal.cellRef,
                      null,
                    );
                  }
                  setCatalogConditionModal({
                    visible: false,
                    cellRef: null,
                    conditionCellsInput: "",
                  });
                }}
              >
                Quitar configuración
              </button>
              <button
                className="px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => {
                  if (!catalogConditionModal.cellRef) return;
                  const refs = catalogConditionModal.conditionCellsInput
                    .split(",")
                    .map((s) => s.trim().toUpperCase())
                    .filter((s) => /^[A-Z]+\d+$/.test(s));
                  setCellCatalogConditionCells(
                    activeSheetId,
                    catalogConditionModal.cellRef,
                    refs,
                  );
                  setCatalogConditionModal({
                    visible: false,
                    cellRef: null,
                    conditionCellsInput: "",
                  });
                }}
              >
                Guardar
              </button>
            </div>
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
      {/* GoTo Config Modal */}
      {goToConfigModal.visible && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-50"
            onClick={() =>
              setGoToConfigModal({
                visible: false,
                cellRef: "",
                conditionCells: "",
              })
            }
          />
          <div
            className="fixed z-50 bg-white border border-gray-300 shadow-xl rounded-lg p-4 w-96"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                🎯 Configurar "Ir a" - {goToConfigModal.cellRef}
              </h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() =>
                  setGoToConfigModal({
                    visible: false,
                    cellRef: "",
                    conditionCells: "",
                  })
                }
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Ingresa las celdas cuyo valor determina a qué tabla navegar.
              Separadas por coma (ej: A1, A2).
            </p>
            <input
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={goToConfigModal.conditionCells}
              onChange={(e) =>
                setGoToConfigModal((prev) => ({
                  ...prev,
                  conditionCells: e.target.value,
                }))
              }
              placeholder="A1, A2"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
                onClick={() =>
                  setGoToConfigModal({
                    visible: false,
                    cellRef: "",
                    conditionCells: "",
                  })
                }
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => {
                  const refs = goToConfigModal.conditionCells
                    .split(",")
                    .map((s) => s.trim().toUpperCase())
                    .filter((s) => /^[A-Z]+\d+$/.test(s));
                  saveGoToConfig(goToConfigModal.cellRef, refs);
                  setGoToConfigModal({
                    visible: false,
                    cellRef: "",
                    conditionCells: "",
                  });
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Named Range Modal */}
      {namedRangeModal.visible && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-50"
            onClick={() =>
              setNamedRangeModal({
                visible: false,
                editId: null,
                name: "",
                tags: "",
                startCell: "",
                endCell: "",
              })
            }
          />
          <div
            className="fixed z-50 bg-white border border-gray-300 shadow-xl rounded-lg p-4 w-[28rem]"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                📋 {namedRangeModal.editId ? "Editar" : "Nueva"} tabla
                etiquetada
              </h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() =>
                  setNamedRangeModal({
                    visible: false,
                    editId: null,
                    name: "",
                    tags: "",
                    startCell: "",
                    endCell: "",
                  })
                }
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Nombre
                </label>
                <input
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={namedRangeModal.name}
                  onChange={(e) =>
                    setNamedRangeModal((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Tabla Aluminio-Cobre"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Etiquetas (separadas por coma) — deben coincidir con los
                  valores de las celdas condición
                </label>
                <input
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={namedRangeModal.tags}
                  onChange={(e) =>
                    setNamedRangeModal((prev) => ({
                      ...prev,
                      tags: e.target.value,
                    }))
                  }
                  placeholder="aluminio, cobre"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">
                    Celda inicio
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={namedRangeModal.startCell}
                    onChange={(e) =>
                      setNamedRangeModal((prev) => ({
                        ...prev,
                        startCell: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="A10"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">
                    Celda fin
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={namedRangeModal.endCell}
                    onChange={(e) =>
                      setNamedRangeModal((prev) => ({
                        ...prev,
                        endCell: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="F20"
                  />
                </div>
              </div>
            </div>

            {/* List of existing named ranges on this sheet */}
            {(currentSheet?.namedRanges || []).length > 0 && (
              <div className="mt-3 border-t pt-2">
                <p className="text-xs text-gray-500 mb-1 font-medium">
                  Tablas etiquetadas en esta hoja:
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {(currentSheet?.namedRanges || []).map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-700">
                          {r.name}
                        </span>
                        <span className="text-gray-400 ml-1">
                          [{r.tags.join(", ")}]
                        </span>
                        <span className="text-gray-400 ml-1">
                          {r.startCell}:{r.endCell}
                        </span>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          className="text-blue-500 hover:text-blue-700"
                          title="Editar"
                          onClick={() =>
                            setNamedRangeModal({
                              visible: true,
                              editId: r.id,
                              name: r.name,
                              tags: r.tags.join(", "),
                              startCell: r.startCell,
                              endCell: r.endCell,
                            })
                          }
                        >
                          ✎
                        </button>
                        <button
                          className="text-blue-500 hover:text-blue-700"
                          title="Ir a"
                          onClick={() => {
                            // Navigate directly to this range
                            setSelectedCell(r.startCell);
                            selectionAnchorRef.current = r.startCell;
                            setSelectedCells(new Set([r.startCell]));
                            setTimeout(() => {
                              if (scrollToCellRef.current) {
                                scrollToCellRef.current(r.startCell);
                              }
                            }, 50);
                            setNamedRangeModal({
                              visible: false,
                              editId: null,
                              name: "",
                              tags: "",
                              startCell: "",
                              endCell: "",
                            });
                          }}
                        >
                          →
                        </button>
                        <button
                          className="text-red-500 hover:text-red-700"
                          title="Eliminar"
                          onClick={() => deleteNamedRange(r.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
                onClick={() =>
                  setNamedRangeModal({
                    visible: false,
                    editId: null,
                    name: "",
                    tags: "",
                    startCell: "",
                    endCell: "",
                  })
                }
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => {
                  const tags = namedRangeModal.tags
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (
                    !namedRangeModal.name.trim() ||
                    tags.length === 0 ||
                    !namedRangeModal.startCell ||
                    !namedRangeModal.endCell
                  ) {
                    return;
                  }
                  const range: NamedRange = {
                    id: namedRangeModal.editId || `nr-${Date.now()}`,
                    name: namedRangeModal.name.trim(),
                    tags,
                    startCell: namedRangeModal.startCell,
                    endCell: namedRangeModal.endCell,
                  };
                  saveNamedRange(range);
                  setNamedRangeModal({
                    visible: false,
                    editId: null,
                    name: "",
                    tags: "",
                    startCell: "",
                    endCell: "",
                  });
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Semi-finished Zone Modal */}
      {semiFinishedZoneModal.visible && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-50"
            onClick={() =>
              setSemiFinishedZoneModal({
                visible: false,
                editId: null,
                semiFinishedId: null,
                startCell: "",
                endCell: "",
              })
            }
          />
          <div
            className="fixed z-50 bg-white border border-gray-300 shadow-xl rounded-lg p-4 w-[28rem]"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                🏷️{" "}
                {semiFinishedZoneModal.editId ? "Editar" : "Nueva"} zona
                semi-terminado
              </h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() =>
                  setSemiFinishedZoneModal({
                    visible: false,
                    editId: null,
                    semiFinishedId: null,
                    startCell: "",
                    endCell: "",
                  })
                }
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Semi-terminado
                </label>
                <Select<number>
                  options={semiFinishedOptions}
                  selectedValue={semiFinishedZoneModal.semiFinishedId}
                  isLoading={isLoadingSemiFinished}
                  placeholder="Selecciona un semi-terminado..."
                  onChange={(value) =>
                    setSemiFinishedZoneModal((prev) => ({
                      ...prev,
                      semiFinishedId: value ?? null,
                    }))
                  }
                />
                {semiFinishedZoneModal.semiFinishedId !== null && (() => {
                  const sf = (semiFinishedList || []).find(
                    (s) => s.id === semiFinishedZoneModal.semiFinishedId,
                  );
                  if (!sf) return null;
                  const palette = getSemiFinishedColor(sf.code);
                  return (
                    <div
                      className="mt-2 inline-flex items-center gap-2 px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: palette.bg,
                        color: palette.text,
                        border: `1px solid ${palette.border}`,
                      }}
                    >
                      <span
                        className="inline-block w-3 h-3 rounded"
                        style={{ backgroundColor: palette.border }}
                      />
                      Color asignado a {sf.code}
                    </div>
                  );
                })()}
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">
                    Celda inicio
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={semiFinishedZoneModal.startCell}
                    onChange={(e) =>
                      setSemiFinishedZoneModal((prev) => ({
                        ...prev,
                        startCell: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="A1"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">
                    Celda fin
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={semiFinishedZoneModal.endCell}
                    onChange={(e) =>
                      setSemiFinishedZoneModal((prev) => ({
                        ...prev,
                        endCell: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="C5"
                  />
                </div>
              </div>
            </div>

            {(currentSheet?.semiFinishedZones || []).length > 0 && (
              <div className="mt-3 border-t pt-2">
                <p className="text-xs text-gray-500 mb-1 font-medium">
                  Zonas en esta hoja:
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {(currentSheet?.semiFinishedZones || []).map((z) => {
                    const palette = getSemiFinishedColor(z.semiFinishedCode);
                    return (
                      <div
                        key={z.id}
                        className="flex items-center justify-between text-xs rounded px-2 py-1"
                        style={{
                          backgroundColor: palette.bg,
                          border: `1px solid ${palette.border}`,
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <span
                            className="font-medium"
                            style={{ color: palette.text }}
                          >
                            {z.semiFinishedName}
                          </span>
                          <span
                            className="ml-1"
                            style={{ color: palette.text, opacity: 0.7 }}
                          >
                            [{z.semiFinishedCode}]
                          </span>
                          <span
                            className="ml-1"
                            style={{ color: palette.text, opacity: 0.7 }}
                          >
                            {z.startCell}:{z.endCell}
                          </span>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            className="text-blue-600 hover:text-blue-800"
                            title="Editar"
                            onClick={() =>
                              setSemiFinishedZoneModal({
                                visible: true,
                                editId: z.id,
                                semiFinishedId: z.semiFinishedId,
                                startCell: z.startCell,
                                endCell: z.endCell,
                              })
                            }
                          >
                            ✎
                          </button>
                          <button
                            className="text-red-600 hover:text-red-800"
                            title="Eliminar"
                            onClick={() => deleteSemiFinishedZone(z.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
                onClick={() =>
                  setSemiFinishedZoneModal({
                    visible: false,
                    editId: null,
                    semiFinishedId: null,
                    startCell: "",
                    endCell: "",
                  })
                }
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  semiFinishedZoneModal.semiFinishedId === null ||
                  !semiFinishedZoneModal.startCell ||
                  !semiFinishedZoneModal.endCell
                }
                onClick={() => {
                  if (
                    semiFinishedZoneModal.semiFinishedId === null ||
                    !semiFinishedZoneModal.startCell ||
                    !semiFinishedZoneModal.endCell
                  ) {
                    return;
                  }
                  const sf = (semiFinishedList || []).find(
                    (s) => s.id === semiFinishedZoneModal.semiFinishedId,
                  );
                  if (!sf) return;
                  const zone: SemiFinishedZone = {
                    id:
                      semiFinishedZoneModal.editId ||
                      `sfz-${Date.now()}`,
                    semiFinishedId: sf.id,
                    semiFinishedCode: sf.code,
                    semiFinishedName: sf.name,
                    startCell: semiFinishedZoneModal.startCell,
                    endCell: semiFinishedZoneModal.endCell,
                  };
                  saveSemiFinishedZone(zone);
                  setSemiFinishedZoneModal({
                    visible: false,
                    editId: null,
                    semiFinishedId: null,
                    startCell: "",
                    endCell: "",
                  });
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Item Catalog Table Modal */}
      {catalogTableModal.visible &&
        (() => {
          const startPos = parseCellRef(catalogTableModal.startCell);
          const endPos = parseCellRef(catalogTableModal.endCell);
          const minCol =
            startPos && endPos
              ? Math.min(startPos.col, endPos.col)
              : 0;
          const maxCol =
            startPos && endPos
              ? Math.max(startPos.col, endPos.col)
              : 0;
          const colCount = startPos && endPos ? maxCol - minCol + 1 : 0;
          const rowCount =
            startPos && endPos
              ? Math.abs(endPos.row - startPos.row) + 1
              : 0;
          // Build the offset options (0..colCount-1) labeled with the
          // absolute column letter so the user can match the spreadsheet.
          const columnOptions: Option<number>[] = [];
          for (let i = 0; i < colCount; i++) {
            columnOptions.push({
              label: `Columna ${getColumnLabel(minCol + i)}`,
              value: i,
            });
          }
          const closeModal = () =>
            setCatalogTableModal({
              visible: false,
              editId: null,
              name: "",
              tagsInput: "",
              startCell: "",
              endCell: "",
              headerRows: 1,
              idColumnOffset: 0,
              descriptionColumnOffset: 1,
              umColumnOffset: 2,
            });
          const offsetsAreValid =
            colCount > 0 &&
            catalogTableModal.idColumnOffset < colCount &&
            catalogTableModal.descriptionColumnOffset < colCount &&
            catalogTableModal.umColumnOffset < colCount;
          const offsetsAreDistinct =
            new Set([
              catalogTableModal.idColumnOffset,
              catalogTableModal.descriptionColumnOffset,
              catalogTableModal.umColumnOffset,
            ]).size === 3;
          const headerRowsValid =
            catalogTableModal.headerRows >= 0 &&
            catalogTableModal.headerRows < rowCount;
          const canSave =
            !!catalogTableModal.name.trim() &&
            !!catalogTableModal.startCell &&
            !!catalogTableModal.endCell &&
            offsetsAreValid &&
            offsetsAreDistinct &&
            headerRowsValid;
          return (
            <>
              <div
                className="fixed inset-0 bg-black bg-opacity-30 z-50"
                onClick={closeModal}
              />
              <div
                className="fixed z-50 bg-white border border-gray-300 shadow-xl rounded-lg p-4 w-[30rem]"
                style={{
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    📚{" "}
                    {catalogTableModal.editId ? "Editar" : "Nueva"} tabla
                    catálogo
                  </h3>
                  <button
                    className="text-gray-400 hover:text-gray-600"
                    onClick={closeModal}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Nombre
                    </label>
                    <input
                      className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={catalogTableModal.name}
                      onChange={(e) =>
                        setCatalogTableModal((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="Ej: Alambres rectangulares aluminio"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Tags{" "}
                      <span className="text-gray-400 font-normal">
                        (palabras clave separadas por coma — se comparan con
                        las celdas de condición al vincular)
                      </span>
                    </label>
                    <input
                      className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={catalogTableModal.tagsInput}
                      onChange={(e) =>
                        setCatalogTableModal((prev) => ({
                          ...prev,
                          tagsInput: e.target.value,
                        }))
                      }
                      placeholder="Ej: aluminio, rectangular"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">
                        Celda inicio
                      </label>
                      <input
                        className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={catalogTableModal.startCell}
                        onChange={(e) =>
                          setCatalogTableModal((prev) => ({
                            ...prev,
                            startCell: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="A1"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">
                        Celda fin
                      </label>
                      <input
                        className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={catalogTableModal.endCell}
                        onChange={(e) =>
                          setCatalogTableModal((prev) => ({
                            ...prev,
                            endCell: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="G6"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Filas de encabezado a omitir
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={catalogTableModal.headerRows}
                      onChange={(e) =>
                        setCatalogTableModal((prev) => ({
                          ...prev,
                          headerRows: Math.max(
                            0,
                            Number.parseInt(e.target.value || "0") || 0,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Columna Item ID
                    </label>
                    <Select<number>
                      options={columnOptions}
                      selectedValue={catalogTableModal.idColumnOffset}
                      placeholder="Selecciona columna..."
                      isLoading={false}
                      onChange={(value) =>
                        setCatalogTableModal((prev) => ({
                          ...prev,
                          idColumnOffset: value ?? 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Columna Descripción
                    </label>
                    <Select<number>
                      options={columnOptions}
                      selectedValue={
                        catalogTableModal.descriptionColumnOffset
                      }
                      placeholder="Selecciona columna..."
                      isLoading={false}
                      onChange={(value) =>
                        setCatalogTableModal((prev) => ({
                          ...prev,
                          descriptionColumnOffset: value ?? 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Columna Unidad de Medida
                    </label>
                    <Select<number>
                      options={columnOptions}
                      selectedValue={catalogTableModal.umColumnOffset}
                      placeholder="Selecciona columna..."
                      isLoading={false}
                      onChange={(value) =>
                        setCatalogTableModal((prev) => ({
                          ...prev,
                          umColumnOffset: value ?? 0,
                        }))
                      }
                    />
                  </div>
                </div>

                {colCount > 0 && colCount < 3 && (
                  <p className="text-xs text-red-600 mt-2">
                    El rango debe tener al menos 3 columnas para mapear Item
                    ID, Descripción y U.M.
                  </p>
                )}
                {colCount >= 3 && !offsetsAreDistinct && (
                  <p className="text-xs text-red-600 mt-2">
                    Las tres columnas (ID, Descripción, U.M.) deben ser
                    distintas.
                  </p>
                )}
                {!headerRowsValid && rowCount > 0 && (
                  <p className="text-xs text-red-600 mt-2">
                    El número de filas de encabezado debe ser menor a la
                    altura del rango ({rowCount}).
                  </p>
                )}

                {(currentSheet?.itemCatalogTables || []).length > 0 && (
                  <div className="mt-3 border-t pt-2">
                    <p className="text-xs text-gray-500 mb-1 font-medium">
                      Tablas en esta hoja:
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {(currentSheet?.itemCatalogTables || []).map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between text-xs rounded px-2 py-1 bg-cyan-50 border border-cyan-300"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-cyan-900">
                              {t.name}
                            </span>
                            <span className="ml-1 text-cyan-700 opacity-80">
                              {t.startCell}:{t.endCell}
                            </span>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <button
                              className="text-blue-600 hover:text-blue-800"
                              title="Editar"
                              onClick={() =>
                                setCatalogTableModal({
                                  visible: true,
                                  editId: t.id,
                                  name: t.name,
                                  tagsInput: (t.tags || []).join(", "),
                                  startCell: t.startCell,
                                  endCell: t.endCell,
                                  headerRows: t.headerRows,
                                  idColumnOffset: t.idColumnOffset,
                                  descriptionColumnOffset:
                                    t.descriptionColumnOffset,
                                  umColumnOffset: t.umColumnOffset,
                                })
                              }
                            >
                              ✎
                            </button>
                            <button
                              className="text-red-600 hover:text-red-800"
                              title="Eliminar"
                              onClick={() => deleteItemCatalogTable(t.id)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-3">
                  <button
                    className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
                    onClick={closeModal}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!canSave}
                    onClick={() => {
                      if (!canSave) return;
                      const parsedTags = catalogTableModal.tagsInput
                        .split(",")
                        .map((s) => s.trim().toLowerCase())
                        .filter((s) => s.length > 0);
                      const table: ItemCatalogTable = {
                        id:
                          catalogTableModal.editId ||
                          `ict-${Date.now()}`,
                        name: catalogTableModal.name.trim(),
                        tags: parsedTags.length > 0 ? parsedTags : undefined,
                        startCell: catalogTableModal.startCell,
                        endCell: catalogTableModal.endCell,
                        headerRows: catalogTableModal.headerRows,
                        idColumnOffset: catalogTableModal.idColumnOffset,
                        descriptionColumnOffset:
                          catalogTableModal.descriptionColumnOffset,
                        umColumnOffset: catalogTableModal.umColumnOffset,
                      };
                      saveItemCatalogTable(table);
                      closeModal();
                    }}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </>
          );
        })()}

      <ItemPickerModal
        isOpen={itemPickerModal.isOpen}
        onClose={closeItemPickerModal}
        catalogs={itemPickerCatalogs.entries}
        filteredByConditions={itemPickerCatalogs.filteredByConditions}
        targetCellRef={itemPickerModal.sourceCellRef ?? undefined}
        onShowAll={() =>
          setItemPickerModal((prev) => ({ ...prev, showAll: true }))
        }
        onSelect={(link) => {
          if (
            itemPickerModal.sourceSheetId &&
            itemPickerModal.sourceCellRef
          ) {
            setCellItemLink(
              itemPickerModal.sourceSheetId,
              itemPickerModal.sourceCellRef,
              link,
            );
          }
          closeItemPickerModal();
        }}
      />

      <SheetTabs
        sheets={sheets}
        activeSheetId={activeSheetId}
        editingSheetName={editingSheetName}
        onSwitchToSheet={switchToSheet}
        onDeleteSheet={deleteSheet}
        onSheetNameKeyPress={handleSheetNameKeyPress}
        onSetEditingSheetName={setEditingSheetName}
        onAddNewSheet={addNewSheet}
        onAddBomSheet={createBomSummarySheet}
        selectionStats={selectionStats}
        zoom={zoom}
        onZoomChange={setZoom}
      />
    </div>
  );
};

export default SpreadSheet;
