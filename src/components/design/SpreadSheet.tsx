import type React from "react";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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

const ROWS = 100;
const COLS = 26;
const COLUMN_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DEFAULT_COLUMN_WIDTH = 96;
const DEFAULT_ROW_HEIGHT = 32;
const MIN_COLUMN_WIDTH = 60;
const MIN_ROW_HEIGHT = 24;

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

  // Handler to update cell style
  const updateCellStyle = (
    style: Partial<{
      bold: boolean;
      textColor: string;
      backgroundColor: string;
      border: string;
    }>,
  ) => {
    setSheets((prevSheets) =>
      prevSheets.map((sheet) => {
        if (sheet.id !== activeSheetId) return sheet;
        return {
          ...sheet,
          cells: {
            ...sheet.cells,
            [selectedCell]: {
              ...sheet.cells[selectedCell],
              ...style,
            },
          },
        };
      }),
    );
  };

  // Expose toolbar render function for FormulaBar
  (window as any).onCellStyleToolbarRender = () => (
    <div className="flex items-center gap-2 mt-1">
      <button
        className={`px-2 py-1 border rounded ${cellBold ? "font-bold bg-gray-200" : ""}`}
        title="Negrita"
        onClick={() => updateCellStyle({ bold: !cellBold })}
        type="button"
      >
        B
      </button>
      <input
        type="color"
        value={cellTextColor || "#000000"}
        title="Color de texto"
        onChange={(e) => updateCellStyle({ textColor: e.target.value })}
        className="w-8 h-8 p-0 border rounded"
      />
      <input
        type="color"
        value={cellBackgroundColor || "#ffffff"}
        title="Color de fondo"
        onChange={(e) => updateCellStyle({ backgroundColor: e.target.value })}
        className="w-8 h-8 p-0 border rounded"
      />
      <select
        value={cellBorder || ""}
        title="Borde"
        onChange={(e) => updateCellStyle({ border: e.target.value })}
        className="px-2 py-1 border rounded"
      >
        <option value="">Sin borde</option>
        <option value="1px solid #000">Negro</option>
        <option value="1px solid #888">Gris</option>
        <option value="2px solid #007bff">Azul</option>
        <option value="2px solid #e11d48">Rojo</option>
      </select>
    </div>
  );
  const [activeSheetId, setActiveSheetId] = useState<string>(
    sheetsInitialData && sheetsInitialData.length > 0
      ? sheetsInitialData[0].id
      : `${instanceId}-sheet1`,
  );
  const [selectedCell, setSelectedCell] = useState<string>("A1");
  const [formulaInput, setFormulaInput] = useState<string>("");
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
    type: "row" | "column" | null;
    index: number;
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

  const formulaInputRef = useRef<HTMLInputElement>(null);

  // Get current sheet
  const currentSheet = sheets.find((sheet) => sheet.id === activeSheetId);
  const cells = useMemo(() => currentSheet?.cells || {}, [currentSheet?.cells]);
  const columnWidths = currentSheet?.columnWidths || {};
  const rowHeights = currentSheet?.rowHeights || {};
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

  // Update toolbar state when selected cell changes
  useEffect(() => {
    const cell = cells[selectedCell];
    setCellTextColor(cell?.textColor || "");
    setCellBackgroundColor(cell?.backgroundColor || "");
    setCellBorder(cell?.border || "");
    setCellBold(!!cell?.bold);
  }, [selectedCell, cells]);

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
    return `${COLUMN_LABELS[col]}${row + 1}`;
  };

  // Parse cell reference to row/col
  const parseCellRef = (ref: string): { row: number; col: number } | null => {
    const match = ref.match(/^([A-Z])(\d+)$/);
    if (!match) return null;
    const col = COLUMN_LABELS.indexOf(match[1]);
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
    const crossInstanceMatch = ref.match(/^([^:]+):(.+?)!([A-Z]\d+)$/);

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
    const crossSheetMatch = ref.match(/^(.+?)!([A-Z]\d+)$/);
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
    if (/^[A-Z]\d+$/.test(ref)) {
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
    (ref: string): number | string => {
      const parsed = parseCrossSheetRef(
        ref,
        sheets,
        activeSheetId,
        instanceId,
        allSheets,
      );
      if (!parsed) {
        return 0;
      }

      // Find the correct instance's sheets
      let targetSheets = sheets;
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
    [sheets, activeSheetId, allSheets, instanceId],
  );

  // Select a cell (used for navigation)
  const selectCell = useCallback(
    (cellRef: string) => {
      setSelectedCell(cellRef);
      const cell = cells[cellRef];
      const cellFormula = cell?.formula || "";
      setFormulaInput(cellFormula);
      setFormulaCursorPosition(cellFormula.length);
      setIsFormulaBuildingMode(cellFormula.startsWith("="));
      setRangeSelectionStart(null);
      setIsAddingToFormula(false);
    },
    [cells],
  );

  // Navigate to adjacent cell
  const navigateCell = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const currentPos = parseCellRef(selectedCell);
      if (!currentPos) return;

      let newRow = currentPos.row;
      let newCol = currentPos.col;

      switch (direction) {
        case "up":
          newRow = Math.max(0, currentPos.row - 1);
          break;
        case "down":
          newRow = Math.min(ROWS - 1, currentPos.row + 1);
          break;
        case "left":
          newCol = Math.max(0, currentPos.col - 1);
          break;
        case "right":
          newCol = Math.min(COLS - 1, currentPos.col + 1);
          break;
      }

      const newCellRef = getCellRef(newRow, newCol);
      selectCell(newCellRef);
    },
    [selectedCell, selectCell],
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
      const delta = currentPos - isResizing.startPos;
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
  }, [isResizing, activeSheetId]);

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
            // Start editing the selected cell inline
            if (formulaInputRef.current) {
              formulaInputRef.current.focus();
              formulaInputRef.current.setSelectionRange(
                formulaInput.length,
                formulaInput.length,
              );
            }
            break;
          case "Delete":
          case "Backspace":
            e.preventDefault();
            // Clear cell content
            setFormulaInput("");
            // Note: we'll call the updateCell function when it's defined later
            break;
          default:
            // If user types a regular character, start editing
            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
              e.preventDefault();
              setFormulaInput(e.key);
              // Note: we'll call the updateCell function when it's defined later
              // Start editing the selected cell inline
              if (formulaInputRef.current) {
                formulaInputRef.current.focus();
                formulaInputRef.current.setSelectionRange(
                  e.key.length,
                  e.key.length,
                );
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
  ]);

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
          if (/^([A-Z]\d+|.+![A-Z]\d+)$/.test(arg)) {
            const cellValue = getCellValueFromAnySheet(arg);
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
              const cellValue = getCellValueFromAnySheet(ref);
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
              const cellValue = getCellValueFromAnySheet(ref);
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

          const params = args
            .split(",")
            .map((param: string) => param.trim())
            .filter((param: unknown) => param !== "");

          if (params.length < 3) {
            return "0";
          }

          const lookupValue = params[0];
          const tableRange = params[1];
          const columnIndex = Number.parseInt(params[2]);
          const exactMatch = params[3]
            ? params[3].toLowerCase() === "true" || params[3] === "1"
            : true;

          if (isNaN(columnIndex) || columnIndex < 1) {
            return "0";
          }

          // Parse the table range (e.g., A1:D10)
          if (!tableRange.includes(":") || tableRange.includes("!")) {
            return "0";
          }

          const [start, end] = tableRange.split(":");
          const startPos = parseCellRef(start.trim());
          const endPos = parseCellRef(end.trim());

          if (!startPos || !endPos) {
            return "0";
          }

          // Get the lookup value
          let searchValue: string | number;
          if (/^[A-Z]\d+$/.test(lookupValue)) {
            searchValue = getCellValueFromAnySheet(lookupValue);
          } else if (!isNaN(Number.parseFloat(lookupValue))) {
            searchValue = Number.parseFloat(lookupValue);
          } else {
            // Remove quotes if it's a string literal
            searchValue = lookupValue.replace(/^["']|["']$/g, "");
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
            const lookupCell = cellGrid[lookupCellRef];

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
              const resultCell = cellGrid[resultCellRef];

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
            const resultCell = cellGrid[resultCellRef];

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
          if (/^\$?[A-Z]\$?\d+$/.test(lookupValueParam)) {
            const cleanRef = lookupValueParam.replace(/\$/g, "");
            searchValue = getCellValueFromAnySheet(cleanRef);
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
                } else if (/^\$?[A-Z]\$?\d+$/.test(indexParam)) {
                  // It's a cell reference (with or without $ symbols): C21, $C$21, etc.
                  const cleanRef = indexParam.replace(/\$/g, "");
                  const cellValue = getCellValueFromAnySheet(cleanRef);
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
                  if (/^\$?[A-Z]\$?\d+$/.test(selectedParam)) {
                    const cleanRef = selectedParam.replace(/\$/g, "");
                    const cellValue = getCellValueFromAnySheet(cleanRef);
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
          /\$?([A-Za-z0-9]+:[A-Za-z0-9]+!|[A-Za-z0-9]+!)?\$?[A-Z]\$?\d+/g,
          (match) => {
            const cleanMatch = match.replace(/\$/g, "");
            const cellValue = getCellValueFromAnySheet(cleanMatch);
            if (typeof cellValue === "number") {
              return cellValue.toString();
            }
            return "0";
          },
        );

        // Handle power operator (^) - convert to Math.pow
        expression = expression.replace(
          /(\d+(?:\.\d+)?|$$[^)]+$$)\s*\^\s*(\d+(?:\.\d+)?|$$[^)]+$$)/g,
          (_, base, exponent) => `Math.pow(${base}, ${exponent})`,
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
      }));

      // Set the initial sheets data
      setSheets(normalizedSheets);
      setInitialSheetsLoaded(true);

      // Set active sheet to the first sheet in the new data
      if (normalizedSheets[0]?.id) {
        setActiveSheetId(normalizedSheets[0].id);
        setSelectedCell("A1");
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

  // Update cell value in current sheet
  const updateCell = useCallback(
    (cellRef: string, value: string) => {
      // First update the cell with its new value
      setSheets((prevSheets) => {
        const updatedSheets = prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            const newCells = { ...sheet.cells };

            // Create a new cell object or update existing one properly
            newCells[cellRef] = {
              value: value,
              formula: value,
              computed: value, // Set initial computed value
            };

            return { ...sheet, cells: newCells };
          }
          return sheet;
        });

        // After the update, calculate only dependent cells
        const recalculateDependentCells = async () => {
          const currentSheet = updatedSheets.find(
            (sheet) => sheet.id === activeSheetId,
          );
          if (!currentSheet) return;

          const newCells = { ...currentSheet.cells };

          // Get all cells that need to be recalculated
          const cellsToRecalculate = getDependencyChain(cellRef, newCells);
          const updatedComputedValues: Record<string, string | number> = {};

          // Sort cells to handle dependencies in correct order
          // Simple approach: process the changed cell first, then others
          const sortedCells = [
            cellRef,
            ...cellsToRecalculate.filter((ref) => ref !== cellRef),
          ];

          // Process each cell that needs recalculation
          for (const ref of sortedCells) {
            if (!newCells[ref]) continue;

            try {
              const result = await evaluateFormula(
                newCells[ref].formula,
                newCells,
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
        };

        // Run the recalculation immediately
        recalculateDependentCells();

        return updatedSheets;
      });
    },
    [evaluateFormula, activeSheetId, getDependencyChain],
  );

  // Insert text at cursor position
  const insertAtCursor = (textToInsert: string) => {
    const currentPosition = formulaCursorPosition;
    const newFormula =
      formulaInput.slice(0, currentPosition) +
      textToInsert +
      formulaInput.slice(currentPosition);

    setFormulaInput(newFormula);
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

  // Handle cell click
  const handleCellClick = (cellRef: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
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
      // Normal cell selection - just select, don't focus formula input
      selectCell(cellRef);
    }
  };

  // Handle formula input change
  const handleFormulaChange = (value: string) => {
    setFormulaInput(value);
    updateCursorPosition();

    // Check if we're in formula mode
    const isFormula = value.startsWith("=");
    setIsFormulaBuildingMode(isFormula);

    if (!isFormula) {
      setRangeSelectionStart(null);
      setIsAddingToFormula(false);
    }

    // Don't update cell on every keystroke - only on Enter or blur
  };

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
    };

    // If there's exactly one template, load it into the new sheet
    if (templates.length === 1) {
      const template = templates[0];
      newSheet.cells = { ...template.cells };
      newSheet.columnWidths = { ...template.cellsStyles.columnWidths };
      newSheet.rowHeights = { ...template.cellsStyles.rowHeights };
    }

    setSheets((prev) => [...prev, newSheet]);
    setActiveSheetId(newSheet.id);
    setSelectedCell("A1");
    setFormulaInput("");

    // If template was loaded, recalculate formulas for the new sheet
    if (templates.length === 1) {
      setTimeout(() => {
        const recalculateNewSheetFormulas = async () => {
          const template = templates[0];
          const newCells = { ...template.cells };
          const updatedComputedValues: Record<string, string | number> = {};

          // Process all cells to recalculate formulas
          for (const ref of Object.keys(newCells)) {
            try {
              const result = await evaluateFormula(
                newCells[ref].formula,
                newCells,
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

  // Load template into current sheet
  const loadTemplate = useCallback(
    (template: Template) => {
      setSheets((prevSheets) => {
        const updatedSheets = prevSheets.map((sheet) => {
          if (sheet.id === activeSheetId) {
            // Process template cells to populate with element values if elementKey exists
            const processedCells = { ...template.cells };

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
              columnWidths: { ...template.cellsStyles.columnWidths },
              rowHeights: { ...template.cellsStyles.rowHeights },
              templateHiddenRows: new Set<number>(
                template.cellsStyles.hiddenRows || [],
              ),
              templateHiddenColumns: new Set<number>(
                template.cellsStyles.hiddenColumns || [],
              ),
              userHiddenRows: new Set<number>(),
              userHiddenColumns: new Set<number>(),
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
      setFormulaInput("");
    },
    [activeSheetId, evaluateFormula],
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
      <div className="bg-gray-100 border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Cálculos</h1>
        </div>
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
            updateCell(selectedCell, formulaInput);
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
        isAddingToFormula={isAddingToFormula}
        rangeSelectionStart={rangeSelectionStart}
        getColumnWidth={getColumnWidth}
        getRowHeight={getRowHeight}
        handleCellClick={handleCellClick}
        handleResizeStart={handleResizeStart}
        hiddenRows={hiddenRows}
        hiddenColumns={hiddenColumns}
        onRowHeaderContextMenu={handleRowHeaderContextMenu}
        onColumnHeaderContextMenu={handleColumnHeaderContextMenu}
      />

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-white border border-gray-300 shadow-lg rounded z-50"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
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
                Ocultar columna {COLUMN_LABELS[contextMenu.index]}
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
        </div>
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
      />
    </div>
  );
};

export default SpreadSheet;
