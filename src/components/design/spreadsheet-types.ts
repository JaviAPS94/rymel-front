// Type definitions for SpreadSheet components

export interface Cell {
  value: string;
  formula: string;
  computed: string | number;
  // Style properties
  bold?: boolean;
  textColor?: string;
  backgroundColor?: string;
  border?: string; // e.g., '1px solid #000' — shorthand for all sides
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  options?: string[]; // Dropdown options for select functionality
  decimals?: number; // Number of decimal places to display (undefined = auto)
  conditionalFormat?: {
    min?: number;
    max?: number;
    color: string;
  };
  note?: string; // Cell note/comment (like Excel notes)
  goTo?: GoToConfig; // Navigation config for lookup tables
}

// GoTo configuration: links a cell to a named range based on condition cell values
export interface GoToConfig {
  conditionCells: string[]; // Cell refs whose values determine the target (e.g., ["A1", "A2"])
  // Each condition cell value is matched against the tags of named ranges
}

// A labeled region in a sheet that can be navigated to
export interface NamedRange {
  id: string;
  name: string; // Display name (e.g., "Tabla Aluminio-Cobre")
  tags: string[]; // Condition tags to match against (e.g., ["aluminio", "cobre"])
  startCell: string; // Top-left cell of the range (e.g., "A10")
  endCell: string; // Bottom-right cell of the range (e.g., "F20")
}

export interface GraphicShape {
  type: "rectangle" | "circle" | "line";
  dimensions: {
    width?: number;
    height?: number;
    diameter?: number;
    length?: number;
  };
  position: {
    x: number;
    y: number;
  };
  label?: string;
  color?: string;
}

export interface MergedCell {
  startCell: string; // e.g., "A1"
  endCell: string; // e.g., "B3"
  rowSpan: number;
  colSpan: number;
}

export interface CellGrid {
  [key: string]: Cell;
}

export interface Sheet {
  id: string;
  name: string;
  cells: CellGrid;
  columnWidths: { [key: number]: number };
  rowHeights: { [key: number]: number };
  templateHiddenRows: Set<number>;
  templateHiddenColumns: Set<number>;
  userHiddenRows: Set<number>;
  userHiddenColumns: Set<number>;
  hiddenCells: Set<string>; // Track individually hidden cells by cellRef
  freezeRow: number; // Freeze rows up to (not including) this index, 0 means no freeze
  freezeColumn: number; // Freeze columns up to (not including) this index, 0 means no freeze
  mergedCells: MergedCell[]; // Track merged cell ranges
  namedRanges?: NamedRange[]; // Labeled table regions for GoTo navigation
}

export interface CustomFunction {
  id: number;
  name: string;
  code: string;
  formula: string;
  variables: string[];
  description: string;
}

export interface ResizeState {
  type: "column" | "row" | null;
  index: number;
  startPos: number;
  startSize: number;
}

// Constants
export const COLUMN_LABELS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];
export const ROWS = 50;
export const COLS = 26;
export const DEFAULT_COLUMN_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 32;
export const MIN_COLUMN_WIDTH = 50;
export const MIN_ROW_HEIGHT = 20;
