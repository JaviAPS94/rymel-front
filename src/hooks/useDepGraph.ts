import { useRef, useCallback } from "react";
import { CellGrid } from "../components/design/spreadsheet-types";

/**
 * Regex that matches cell references inside formulas.
 * Handles: A1, $A$1, Sheet1!A1, design:Sheet1!A1
 * Groups:  optional sheet prefix, column letters, row digits
 */
const CELL_REF_REGEX =
  /\$?(?:[A-Za-z0-9]+:[A-Za-z0-9]+!|[A-Za-z0-9]+!)?\$?[A-Z]+\$?\d+/g;

/** Also match range references like A1:B5 to expand into individual cells */
const RANGE_REF_REGEX =
  /\$?(?:[A-Za-z0-9]+!)?\$?([A-Z]+)\$?(\d+):\$?(?:[A-Za-z0-9]+!)?\$?([A-Z]+)\$?(\d+)/g;

const colLabelToIndex = (label: string): number => {
  let idx = 0;
  for (let i = 0; i < label.length; i++) {
    idx = idx * 26 + (label.charCodeAt(i) - 64);
  }
  return idx - 1;
};

const indexToColLabel = (col: number): string => {
  let label = "";
  let num = col + 1;
  while (num > 0) {
    const rem = (num - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    num = Math.floor((num - 1) / 26);
  }
  return label;
};

/**
 * Extract every cell reference that a formula depends on (its precedents).
 * Returns normalised refs like "A1", "Sheet1!B2", etc.
 */
const extractPrecedents = (formula: string): Set<string> => {
  if (!formula || !formula.startsWith("=")) return new Set();

  const refs = new Set<string>();
  const expr = formula.slice(1); // remove leading '='

  // 1) Expand range references (A1:B3 → A1,A2,A3,B1,B2,B3)
  let rangeMatch: RegExpExecArray | null;
  const rangeRegex = new RegExp(RANGE_REF_REGEX.source, "g");
  while ((rangeMatch = rangeRegex.exec(expr)) !== null) {
    const startCol = colLabelToIndex(rangeMatch[1]);
    const startRow = parseInt(rangeMatch[2], 10) - 1;
    const endCol = colLabelToIndex(rangeMatch[3]);
    const endRow = parseInt(rangeMatch[4], 10) - 1;

    // Check if there's a sheet prefix before the range
    const fullMatch = rangeMatch[0];
    let sheetPrefix = "";
    const sheetIdx = fullMatch.indexOf("!");
    if (sheetIdx !== -1) {
      sheetPrefix = fullMatch.substring(0, sheetIdx + 1).replace(/\$/g, "");
    }

    for (
      let r = Math.min(startRow, endRow);
      r <= Math.max(startRow, endRow);
      r++
    ) {
      for (
        let c = Math.min(startCol, endCol);
        c <= Math.max(startCol, endCol);
        c++
      ) {
        refs.add(`${sheetPrefix}${indexToColLabel(c)}${r + 1}`);
      }
    }
  }

  // 2) Extract individual cell references (skip those inside range notation)
  const refRegex = new RegExp(CELL_REF_REGEX.source, "g");
  let refMatch: RegExpExecArray | null;
  while ((refMatch = refRegex.exec(expr)) !== null) {
    const clean = refMatch[0].replace(/\$/g, "");
    refs.add(clean);
  }

  return refs;
};

export interface DepGraph {
  /**
   * Forward map: cellRef → Set of cells it DEPENDS ON (precedents).
   * e.g. if C1 = A1+B1, then precedents["C1"] = {"A1","B1"}
   */
  precedents: Map<string, Set<string>>;
  /**
   * Reverse map: cellRef → Set of cells that DEPEND ON it (dependents).
   * e.g. if C1 = A1+B1, then dependents["A1"] = {"C1"}, dependents["B1"] = {"C1"}
   */
  dependents: Map<string, Set<string>>;
}

/**
 * React hook that manages a dependency graph for a spreadsheet sheet.
 *
 * The graph is stored in a ref (not state) because it's a derived
 * structure used for recalculation — it doesn't need to trigger renders.
 */
export const useDepGraph = () => {
  const graphRef = useRef<DepGraph>({
    precedents: new Map(),
    dependents: new Map(),
  });

  /**
   * Rebuild the entire graph from scratch for a given cell grid.
   * Call this when loading / switching sheets.
   */
  const buildGraph = useCallback((cells: CellGrid) => {
    const prec = new Map<string, Set<string>>();
    const deps = new Map<string, Set<string>>();

    for (const cellRef of Object.keys(cells)) {
      const cell = cells[cellRef];
      if (!cell?.formula?.startsWith("=")) continue;

      const cellPrecs = extractPrecedents(cell.formula);
      prec.set(cellRef, cellPrecs);

      // Register this cell as dependent of each precedent
      cellPrecs.forEach((precRef) => {
        if (!deps.has(precRef)) deps.set(precRef, new Set());
        deps.get(precRef)!.add(cellRef);
      });
    }

    graphRef.current = { precedents: prec, dependents: deps };
  }, []);

  /**
   * Incrementally update the graph when a single cell's formula changes.
   * Much cheaper than rebuilding the whole graph.
   */
  const updateCellInGraph = useCallback(
    (cellRef: string, newFormula: string) => {
      const { precedents, dependents } = graphRef.current;

      // 1) Remove old edges: unregister cellRef from old precedents' dependents
      const oldPrecs = precedents.get(cellRef);
      if (oldPrecs) {
        oldPrecs.forEach((oldPrecRef) => {
          dependents.get(oldPrecRef)?.delete(cellRef);
        });
      }

      // 2) Compute new precedents
      const newPrecs = extractPrecedents(newFormula);

      if (newPrecs.size > 0) {
        precedents.set(cellRef, newPrecs);

        // 3) Add new edges: register cellRef as dependent of each new precedent
        newPrecs.forEach((precRef) => {
          if (!dependents.has(precRef)) dependents.set(precRef, new Set());
          dependents.get(precRef)!.add(cellRef);
        });
      } else {
        precedents.delete(cellRef);
      }
    },
    [],
  );

  /**
   * Given a set of "dirty" cells, return ALL cells that need recalculation
   * in correct topological order (dependencies first).
   *
   * Also detects circular references — cells in a cycle get "#CIRCULAR" and
   * are excluded from the returned order.
   */
  const getRecalcOrder = useCallback(
    (dirtyCells: string[]): { order: string[]; circular: Set<string> } => {
      const { dependents } = graphRef.current;

      // 1) BFS to collect all affected cells (dirty + transitive dependents)
      const affected = new Set<string>();
      const queue = [...dirtyCells];

      while (queue.length > 0) {
        const cell = queue.shift()!;
        if (affected.has(cell)) continue;
        affected.add(cell);

        const deps = dependents.get(cell);
        if (deps) {
          deps.forEach((dep) => {
            if (!affected.has(dep)) queue.push(dep);
          });
        }
      }

      // 2) Topological sort (Kahn's algorithm) only over affected cells
      const { precedents: precMap } = graphRef.current;

      // Compute in-degree for each affected cell (only counting edges within affected set)
      const inDegree = new Map<string, number>();
      affected.forEach((cell) => {
        inDegree.set(cell, 0);
      });

      affected.forEach((cell) => {
        const precs = precMap.get(cell);
        if (precs) {
          let count = 0;
          precs.forEach((p) => {
            if (affected.has(p)) count++;
          });
          inDegree.set(cell, count);
        }
      });

      // Start with cells that have no in-degree within the affected set
      const sorted: string[] = [];
      const zeroQueue: string[] = [];

      inDegree.forEach((deg, cell) => {
        if (deg === 0) zeroQueue.push(cell);
      });

      while (zeroQueue.length > 0) {
        const cell = zeroQueue.shift()!;
        sorted.push(cell);

        const deps = dependents.get(cell);
        if (deps) {
          deps.forEach((dep) => {
            if (!affected.has(dep)) return;
            const newDeg = (inDegree.get(dep) ?? 1) - 1;
            inDegree.set(dep, newDeg);
            if (newDeg === 0) zeroQueue.push(dep);
          });
        }
      }

      // 3) Any affected cell NOT in sorted is part of a cycle
      const circular = new Set<string>();
      affected.forEach((cell) => {
        if (!sorted.includes(cell)) circular.add(cell);
      });

      return { order: sorted, circular };
    },
    [],
  );

  /**
   * Quick check: does the graph contain a cycle if we were to add
   * `newFormula` to `cellRef`?  Useful for pre-validation.
   */
  const wouldCreateCycle = useCallback(
    (cellRef: string, newFormula: string): boolean => {
      const newPrecs = extractPrecedents(newFormula);
      if (newPrecs.size === 0) return false;

      // Check if cellRef is reachable from any of its new precedents
      const visited = new Set<string>();
      const stack = [...newPrecs];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === cellRef) return true;
        if (visited.has(current)) continue;
        visited.add(current);

        const currentPrecs = graphRef.current.precedents.get(current);
        if (currentPrecs) {
          currentPrecs.forEach((p) => {
            if (!visited.has(p)) stack.push(p);
          });
        }
      }

      return false;
    },
    [],
  );

  return {
    graphRef,
    buildGraph,
    updateCellInGraph,
    getRecalcOrder,
    wouldCreateCycle,
  };
};
