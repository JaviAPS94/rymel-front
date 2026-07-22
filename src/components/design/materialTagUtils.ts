import { Sheet } from "./spreadsheet-types";

export type MaterialTagValues = {
  moValue?: string;
  materialDevanadoValue?: string;
};

/**
 * Busca, en todas las hojas del diseño, la celda etiquetada como "MO" y la
 * etiquetada como "MD" (material de devanado) y devuelve sus valores actuales.
 * Usado por la generación del código de diseño (ver Decisión 4 del change
 * design-code-generation): esos dos segmentos no vienen de un catálogo, sino
 * de celdas que el usuario etiqueta dentro del propio diseño.
 */
export function extractMaterialTagValues(sheets: Sheet[]): MaterialTagValues {
  const result: MaterialTagValues = {};

  for (const sheet of sheets) {
    for (const cell of Object.values(sheet.cells)) {
      if (cell.materialTag === "MO" && result.moValue === undefined) {
        result.moValue = String(cell.computed ?? cell.value ?? "").trim();
      } else if (
        cell.materialTag === "MD" &&
        result.materialDevanadoValue === undefined
      ) {
        result.materialDevanadoValue = String(
          cell.computed ?? cell.value ?? "",
        ).trim();
      }
    }
  }

  return result;
}
