import { useMemo } from "react";
import { buildGraph, type DepGraph } from "@rymel/formula-engine";
import {
  bookRef,
  traceCell,
  type CellTrace,
  type TraceCellLookup,
} from "@rymel/design-template";
import type { Sheet } from "./spreadsheet-types";

/**
 * Rastreo de celdas en el diseñador: de qué se alimenta una celda y a quién
 * alimenta, incluso entre hojas.
 *
 * La lógica es la de `@rymel/design-template`, la misma del editor de
 * plantillas del administrador, para que las dos pantallas expliquen una celda
 * igual. Lo propio de aquí es leer las hojas del diseño.
 *
 * El grafo con que el diseñador recalcula es de una sola hoja; con él no se
 * verían los dependientes de otras hojas. Para rastrear se arma uno del libro
 * entero con el mismo motor, solo mientras el panel está abierto.
 */

/** Lo escrito en una celda del diseño: su fórmula, o su valor si no tiene. */
const contentOf = (cell: { formula?: string; value?: string } | undefined): string =>
  cell?.formula || cell?.value || "";

/** Todas las celdas del diseño en un libro, con referencias calificadas. */
export const designBook = (sheets: readonly Sheet[]): Record<string, { formula: string }> => {
  const book: Record<string, { formula: string }> = {};
  for (const sheet of sheets) {
    for (const [ref, cell] of Object.entries(sheet.cells)) {
      const content = contentOf(cell);
      if (content !== "") book[bookRef(sheet.name, ref)] = { formula: content };
    }
  }
  return book;
};

/**
 * Las celdas del diseño para el rastreo. El dato del elemento ya viene copiado
 * en la celda, así que se ve como un valor: el diseño no guarda de qué dato
 * salió.
 */
export const designCellLookup =
  (sheets: readonly Sheet[]): TraceCellLookup =>
  (sheetName, ref) => {
    const cell = sheets.find((sheet) => sheet.name === sheetName)?.cells[ref];
    return cell && { content: contentOf(cell) };
  };

export const traceDesignCell = (
  sheets: readonly Sheet[],
  graph: DepGraph,
  sheetName: string,
  ref: string,
  options: { full?: boolean; designFunctionCodes?: readonly string[] } = {},
): CellTrace => traceCell(designCellLookup(sheets), graph, sheetName, ref, options);

/**
 * El rastreo de la celda activa, o `null` con el panel cerrado: entonces ni
 * siquiera se arma el grafo del libro.
 */
export const useDesignCellTrace = (
  sheets: readonly Sheet[],
  sheetName: string,
  ref: string,
  { enabled, full, designFunctionCodes }: {
    enabled: boolean;
    full: boolean;
    designFunctionCodes: readonly string[];
  },
): CellTrace | null => {
  const graph = useMemo(
    () => (enabled ? buildGraph(designBook(sheets)) : null),
    [enabled, sheets],
  );
  return useMemo(
    () =>
      graph ? traceDesignCell(sheets, graph, sheetName, ref, { full, designFunctionCodes }) : null,
    [graph, sheets, sheetName, ref, full, designFunctionCodes],
  );
};
