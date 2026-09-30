import React from "react";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  useReducer,
  startTransition,
} from "react";
import { isReadOnly } from "@rymel/design-template";
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
import {
  Cell,
  CustomFunction,
  ItemCatalogTable,
  Sheet,
  getSemiFinishedColor,
} from "./spreadsheet-types";
import {
  buildGraph as buildFormulaGraph,
  buildRangeRef,
  consumesCellClick,
  createDepGraph,
  formulaBuilderReducer,
  getRecalcOrder as getFormulaRecalcOrder,
  initialFormulaBuilderState,
  insertIntoFormula,
  qualifyCellRef,
  updateCellInGraph as updateFormulaCellInGraph,
  type CustomFunctionCall,
  type CustomFunctionDefinition,
  type CustomFunctionResult,
  type DepGraph,
} from "@rymel/formula-engine";
import {
  evaluateFormulaWith,
  recalculateCells,
  type EvaluableCells,
} from "./formula-evaluation";
import {
  runtimeSheetsFromTemplate,
  type ElementValue,
} from "./template-loading";

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
  // Lets a parent intercept a cell click before the default selection/editing
  // behavior runs (e.g. to implement custom per-cell affordances). Return
  // true to mark the click as handled and skip the default behavior.
  onCellClick?: (cellRef: string, cell: Cell | undefined) => boolean | void;
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
  onCellClick,
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

  const formulaInputValueRef = useRef<string>(""); // Track immediate value without causing re-renders
  /**
   * La construcción de fórmulas vive en `@rymel/formula-engine`.
   *
   * Antes estaba escrita aquí: cuándo calificar una referencia, cómo se forma
   * un rango, qué apaga cada acción. El editor de plantillas del admin necesita
   * exactamente lo mismo, y con dos copias la misma acción acaba produciendo
   * dos fórmulas distintas en cada aplicación. Lo que queda local es la atadura
   * con React —el paquete no puede depender de React sin dejar de correr en el
   * servidor—, no las reglas.
   */
  const [builder, dispatchBuilder] = useReducer(
    formulaBuilderReducer,
    undefined,
    initialFormulaBuilderState,
  );
  const formulaInput = builder.draft;
  const isFormulaBuildingMode = builder.isActive;
  const isAddingToFormula = builder.isPicking;
  const formulaCursorPosition = builder.cursor;
  const rangeSelectionStart = builder.rangeStart;

  /** Hoja a la que pertenece la fórmula: decide qué referencias hay que calificar. */
  const activeSheetName = useMemo(
    () => sheets.find((sheet) => sheet.id === activeSheetId)?.name ?? "",
    [sheets, activeSheetId],
  );

  /**
   * Empieza a editar el contenido de una celda.
   *
   * Un solo punto de entrada porque el estado del modo fórmula se deduce del
   * texto —empieza por `=` o no—, y deducirlo suelto en cada sitio es como se
   * quedaba encendido después de borrar el `=`.
   */
  const startFormula = useCallback(
    (draft: string) => {
      formulaInputValueRef.current = draft;
      dispatchBuilder({
        type: "start",
        draft,
        sheet: activeSheetName,
        instance: instanceId,
      });
    },
    [activeSheetName, instanceId],
  );

  // Cross-tab reference selection state
  const [targetInstanceId, setTargetInstanceId] = useState<string>(instanceId);
  const [targetSheetId, setTargetSheetId] = useState<string>(activeSheetId);

  /**
   * Nombre de la hoja apuntada por el selector de instancia/hoja.
   *
   * Se busca en `allSheets` y no en `sheets` porque el destino puede estar en
   * otra instancia del diseño, que es de donde salen las referencias
   * `costos:Hoja1!A1`.
   */
  const targetSheetName = useMemo(
    () =>
      allSheets
        .find((instance) => instance.instanceId === targetInstanceId)
        ?.sheets.find((sheet) => sheet.id === targetSheetId)?.name,
    [allSheets, targetInstanceId, targetSheetId],
  );
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

  /**
   * Celdas que la plantilla protege.
   *
   * La regla es la del contrato —la misma con la que el editor las señala y
   * el servidor las comprueba—; aquí solo se cumple. Protege lo que el
   * diseñador escribe: el recálculo y el relleno con los datos del elemento
   * al cargar la plantilla no pasan por aquí.
   */
  const isProtected = useCallback(
    (ref: string) => (currentSheet ? isReadOnly(currentSheet, ref) : false),
    [currentSheet],
  );
  const [readOnlyNotice, setReadOnlyNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!readOnlyNotice) return;
    const timer = setTimeout(() => setReadOnlyNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [readOnlyNotice]);
  const warnProtected = useCallback(
    (ref: string) =>
      setReadOnlyNotice(
        `${ref} está protegida por la plantilla y no se puede modificar.`,
      ),
    [],
  );
  /**
   * Quita de una escritura por lotes —pegar— las celdas protegidas, y avisa
   * de cuántas se omitieron. Las demás se escriben.
   */
  const keepWritable = useCallback(
    (writes: { cellRef: string }[]) => {
      const before = writes.length;
      for (let index = writes.length - 1; index >= 0; index--) {
        if (isProtected(writes[index].cellRef)) writes.splice(index, 1);
      }
      const skipped = before - writes.length;
      if (skipped > 0) {
        setReadOnlyNotice(
          `Se omitieron ${skipped} celda(s) protegidas por la plantilla.`,
        );
      }
    },
    [isProtected],
  );
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
  /**
   * Grafo de dependencias, respaldado por el motor compartido.
   *
   * El hook anterior guardaba el grafo en un `useRef` interno; las funciones
   * del motor son puras y reciben el grafo. Se conserva aquí la misma
   * interfaz —el grafo vive en un ref y las tres funciones lo usan— para que
   * los diecisiete puntos que ya lo usaban no cambien.
   */
  const graphRef = useRef<DepGraph>(createDepGraph());

  const buildGraph = useCallback((cells: CellGrid) => {
    graphRef.current = buildFormulaGraph(cells);
  }, []);

  const updateCellInGraph = useCallback(
    (cellRef: string, newFormula: string) => {
      updateFormulaCellInGraph(graphRef.current, cellRef, newFormula);
    },
    [],
  );

  const getRecalcOrder = useCallback(
    (dirtyCells: string[]): { order: string[]; circular: Set<string> } =>
      getFormulaRecalcOrder(graphRef.current, dirtyCells),
    [],
  );

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
        startFormula(cellFormula);
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
      dispatchBuilder({
        type: "cursor",
        cursor: formulaInputRef.current.selectionStart || 0,
      });
    }
  };

  /**
   * Devuelve el foco a la barra con el cursor detrás de lo insertado.
   *
   * Va tras el repintado porque el input todavía tiene el texto anterior: sin
   * esperar, el cursor acabaría en un sitio que ya no existe.
   */
  const restoreFormulaCursor = (position: number) => {
    setTimeout(() => {
      const input = formulaInputRef.current;
      if (!input) return;
      input.focus();
      const at = Math.min(position, input.value.length);
      input.setSelectionRange(at, at);
      dispatchBuilder({ type: "cursor", cursor: at });
    }, 0);
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
            // La expresión ya no viaja al navegador: está cifrada y lo único
            // que se hacía con ella era buscar dentro de un bloque hexadecimal.
            formula: "",
            variables: func.variables.split(",").map((v) => v.trim()),
            description: func.description || "",
          };
        }) || [],
    [subTypeWithFunctions.designFunctions],
  );

  // --- Evaluación de fórmulas: motor compartido ---------------------------

  /**
   * Definiciones de las fórmulas de diseño en el formato del motor.
   *
   * El motor no sabe evaluarlas —la expresión está cifrada y solo el motor
   * cifrado puede resolverla— pero sí necesita reconocerlas para saber que
   * `CUBIC(...)` es una invocación y no una función matemática.
   */
  const customFunctionDefinitions = useMemo<CustomFunctionDefinition[]>(
    () =>
      customFunctions.map((func) => ({
        id: func.id,
        code: func.code,
        variables: func.variables,
      })),
    [customFunctions],
  );

  /**
   * Puerto de resolución de funciones personalizadas.
   *
   * Resuelve **un lote completo en una sola petición**. Antes se hacía una
   * llamada por celda, aunque el endpoint siempre aceptó un arreglo: una hoja
   * con cuarenta celdas que invocan la misma fórmula hacía cuarenta viajes.
   */
  const resolveCustomFunctions = useCallback(
    async (calls: CustomFunctionCall[]): Promise<CustomFunctionResult[]> => {
      if (calls.length === 0) return [];

      try {
        const data = await evaluateFunction({
          functions: calls.map((call) => ({
            designFunctionId: Number(call.definition.id),
            parameters: call.parameters,
          })),
        }).unwrap();

        return calls.map((_, index) => {
          const result = data.results[index];
          return result === undefined
            ? { error: "sin resultado para la invocación" }
            : { value: Number(result.result) };
        });
      } catch {
        // Un fallo del servicio afecta solo a las celdas de este lote.
        return calls.map(() => ({ error: "no se pudo evaluar la fórmula" }));
      }
    },
    [evaluateFunction],
  );

  /**
   * Evalúa una celda con el motor compartido.
   *
   * Sustituye al evaluador anterior, que traducía la fórmula a JavaScript con
   * 26 pasadas de `replace` y la ejecutaba con `Function()`. Eso era ejecución
   * de código arbitrario —una fórmula puede venir de un `.xlsx` que subió
   * cualquiera— y además hacía que el resultado no se pudiera reproducir fuera
   * de un navegador, que es justo lo que el servidor necesita para recalcular.
   *
   * La lógica vive en `formula-evaluation.ts` para poder probarla sin montar
   * React. La firma no cambia, así que sus ocho puntos de llamada siguen igual.
   */
  const evaluateFormula = useCallback(
    async (
      formula: string,
      cellGrid: CellGrid,
      currentSheets: typeof sheets,
    ): Promise<number | string | undefined> =>
      evaluateFormulaWith(formula, {
        customFunctions: customFunctionDefinitions,
        resolveCustomFunctions,
        localCellValue: (ref) => cellGrid[ref]?.computed,
        crossSheetCellValue: (ref) =>
          getCellValueFromAnySheet(ref, currentSheets),
      }),
    [
      customFunctionDefinitions,
      getCellValueFromAnySheet,
      resolveCustomFunctions,
    ],
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
        startFormula("");
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
      const { order } = getRecalcOrder(dirtyCells);

      // Solo las celdas que hay que recalcular, más las originalmente
      // modificadas: el motor las ordena y agrupa por nivel de dependencia.
      const toEvaluate = new Set<string>([...order, ...dirtyCells]);
      // `computed` viaja junto a la fórmula: las celdas que no entran en este
      // recálculo conservan su valor, y sus dependientes pueden leerlo.
      const cells: EvaluableCells = {};
      for (const [ref, cell] of Object.entries(cellGrid)) {
        if (cell) cells[ref] = { formula: cell.formula, computed: cell.computed };
      }

      const { values, circular } = await recalculateCells(cells, dirtyCells, {
        customFunctions: customFunctionDefinitions,
        resolveCustomFunctions,
        crossSheetCellValue: (ref) => getCellValueFromAnySheet(ref, allSheets),
      });

      const updatedValues: Record<string, string | number> = {};

      circular.forEach((ref) => {
        updatedValues[ref] = "#CIRCULAR";
        cellGrid[ref] = { ...cellGrid[ref], computed: "#CIRCULAR" };
      });

      for (const ref of toEvaluate) {
        if (circular.has(ref)) continue;
        const cellToCalc = cellGrid[ref];
        if (!cellToCalc) continue;
        if (!cellToCalc.formula?.startsWith("=") && !dirtyCells.includes(ref))
          continue;

        const value = values[ref];
        updatedValues[ref] = value !== undefined ? value : "";
        cellGrid[ref] = { ...cellGrid[ref], computed: updatedValues[ref] };
      }

      return updatedValues;
    },
    [
      customFunctionDefinitions,
      getCellValueFromAnySheet,
      getRecalcOrder,
      resolveCustomFunctions,
    ],
  );

  // Update cell value in current sheet (optimized for typing performance)
  const updateCell = useCallback(
    async (
      cellRef: string,
      value: string,
      options?: { skipHistory?: boolean; immediate?: boolean },
    ) => {
      if (isProtected(cellRef)) {
        warnProtected(cellRef);
        // La barra vuelve a mostrar lo que la celda tiene de verdad.
        if (cellRef === selectedCell) startFormula(cells[cellRef]?.formula || "");
        return;
      }

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
      isProtected,
      warnProtected,
      selectedCell,
      cells,
      startFormula,
    ],
  );

  // Handler for updating dropdown cell values
  const handleDropdownCellChange = useCallback(
    async (cellRef: string, value: string) => {
      if (isProtected(cellRef)) {
        warnProtected(cellRef);
        return;
      }

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
      isProtected,
      warnProtected,
    ],
  );

  /**
   * Refleja en la celda lo que el reducer acaba de insertar.
   *
   * El texto lo calcula la misma función pura que usa el reducer, así que la
   * celda y la barra no pueden acabar diciendo cosas distintas.
   */
  const mirrorInsertion = (textToInsert: string) => {
    const { formula, cursor } = insertIntoFormula(
      formulaInput,
      formulaCursorPosition,
      textToInsert,
    );

    formulaInputValueRef.current = formula;
    if (editingCell === selectedCell) {
      setInlineCellValue(formula);
    }
    updateCell(selectedCell, formula);
    restoreFormulaCursor(cursor);
  };

  // Insert text at cursor position
  const insertAtCursor = (textToInsert: string) => {
    dispatchBuilder({ type: "insert", text: textToInsert });
    mirrorInsertion(textToInsert);
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

      keepWritable(newCellsData);

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

    keepWritable(newCellsData);

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
    keepWritable,
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
            if (isProtected(selectedCell)) {
              warnProtected(selectedCell);
              break;
            }
            // Clear cell content
            startFormula("");
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
              if (isProtected(selectedCell)) {
                warnProtected(selectedCell);
                break;
              }
              // Start inline editing mode
              setEditingCell(selectedCell);
              setInlineCellValue(e.key);
              startFormula(e.key);
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
    isProtected,
    warnProtected,
  ]);

  // Handle cell click
  const handleCellClick = (cellRef: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (onCellClick && onCellClick(cellRef, cells[cellRef])) {
      return;
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

    if (consumesCellClick(builder)) {
      // La referencia la construye el motor: qué hay que calificar y cómo se
      // forma el rango son sus reglas, no las de este componente.
      const target = {
        sheet: targetSheetName ?? activeSheetName,
        instance: targetInstanceId,
      };
      const current = { sheet: activeSheetName, instance: instanceId };

      const reference =
        rangeSelectionStart && rangeSelectionStart !== cellRef
          ? buildRangeRef(rangeSelectionStart, cellRef, target, current)
          : qualifyCellRef(cellRef, target, current);

      dispatchBuilder({
        type: "pick",
        sheet: target.sheet,
        ref: cellRef,
        instance: target.instance,
      });
      mirrorInsertion(reference);
    } else {
      // Normal cell selection - use single select
      selectSingleCell(cellRef);
    }
  };

  // Handle starting inline editing
  const handleStartInlineEditing = useCallback(
    (cellRef: string) => {
      if (isProtected(cellRef)) {
        warnProtected(cellRef);
        return;
      }
      const cell = cells[cellRef];
      const cellFormula = cell?.formula || "";
      setEditingCell(cellRef);
      setInlineCellValue(cellFormula);
      startFormula(cellFormula);
    },
    [cells, startFormula, isProtected, warnProtected],
  );

  // Handle stopping inline editing
  /**
   * Lo que se teclea dentro de una celda, para que el modo fórmula se encienda
   * en el momento y no al salir de ella.
   *
   * Sin esto, quien escribía `=` en la celda no veía la barra hasta salir y
   * volver a entrar: la celda sabía que había un `=` y el constructor no.
   *
   * Solo se avisa al reducer cuando **cambia** si el contenido es fórmula o
   * no. El input de la celda es no controlado a propósito, y despachar en cada
   * tecla redibujaría la rejilla entera, que es justo lo que esa decisión
   * evita. Entre la transición y el `blur` nadie lee el borrador: al soltar el
   * foco se sincroniza con el texto completo.
   */
  const handleEditingDraft = useCallback(
    (value: string) => {
      if (value.startsWith("=") !== isFormulaBuildingMode) {
        dispatchBuilder({ type: "draft", draft: value });
      }
    },
    [isFormulaBuildingMode],
  );

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
        startFormula(value);
      }
    },
    [editingCell, updateCell, cells, startFormula],
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
      // Use startTransition for non-urgent formula input updates
      startTransition(() => {
        // El reducer deduce del texto si sigue siendo una fórmula, y apaga la
        // selección de celdas cuando deja de serlo.
        dispatchBuilder({ type: "draft", draft: value });
        updateCursorPosition();
      });

      // Don't update cell on every keystroke - only on Enter or blur
    },
    [updateCursorPosition],
  );

  // Toggle adding to formula mode
  const toggleAddingToFormula = () => {
    updateCursorPosition(); // Make sure we have the latest cursor position
    dispatchBuilder({ type: "togglePicking" });

    // Reset to current instance and sheet when enabling
    if (!isAddingToFormula) {
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
    dispatchBuilder({ type: "toggleRange", activeRef: selectedCell });
  };

  // Exit formula building mode
  const exitFormulaBuildingMode = () => {
    dispatchBuilder({ type: "finish" });
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
    startFormula("");

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
      startFormula("");
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
            startFormula("");

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
        // La traducción de la plantilla a hojas la hace el contrato
        // compartido, no este componente. Antes se hacía aquí, y era la
        // segunda de dos traducciones para el mismo dato: por eso las filas
        // que un autor ocultaba en la plantilla —guardadas como
        // `templateHiddenRows`— nunca llegaban, porque aquí se leía
        // `hiddenRows`.
        const newSheets = runtimeSheetsFromTemplate(
          template,
          instanceId,
          element.values as ElementValue[],
        );

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
        startFormula("");
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
      startFormula("");
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
      {readOnlyNotice && (
        <div
          role="status"
          className="mx-2 my-1 rounded bg-amber-50 px-3 py-1 text-sm text-amber-900"
        >
          🔒 {readOnlyNotice}
        </div>
      )}
      <SpreadSheetGrid
        isReadOnlyCell={isProtected}
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
        onEditingDraft={handleEditingDraft}
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
              </>
            )}
            {/* El diseñador usa la hoja; configurarla es trabajo del editor de
                plantillas de project-admin. Aquí quedan solo el estado de su
                sesión —ocultar una celda— y seguir un «Ir a» ya configurado. */}
            {contextMenu.type === "cell" &&
              contextMenu.cellRef &&
              (() => {
                const ref = contextMenu.cellRef;
                const isCellHidden = currentSheet?.hiddenCells?.has(ref);
                const closeMenu = () =>
                  setContextMenu({
                    visible: false,
                    x: 0,
                    y: 0,
                    type: null,
                    index: -1,
                  });
                return (
                  <>
                    {isCellHidden ? (
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        onClick={() => unhideCell(ref)}
                      >
                        Mostrar celda {ref}
                      </button>
                    ) : (
                      <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                        onClick={() => hideCell(ref)}
                      >
                        Ocultar celda {ref}
                      </button>
                    )}
                    {currentSheet?.cells[ref]?.goTo && (
                      <>
                        <div className="border-t my-1"></div>
                        <button
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm text-blue-600 font-medium"
                          onClick={() => {
                            navigateGoTo(ref);
                            closeMenu();
                          }}
                        >
                          🔗 Ir a tabla
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
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
