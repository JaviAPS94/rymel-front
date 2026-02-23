// Type definitions for SpreadSheet components

export interface Cell {
  value: string;
  formula: string;
  computed: string | number;
  // Style properties
  bold?: boolean;
  textColor?: string;
  backgroundColor?: string;
  border?: string; // e.g., '1px solid #000'
  options?: string[]; // Dropdown options for select functionality
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
