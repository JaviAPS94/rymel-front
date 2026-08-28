/**
 * Carga de una plantilla al diseñador, a través del contrato compartido.
 *
 * Antes esta traducción vivía dentro de `loadTemplate`, en `SpreadSheet.tsx`, y
 * era la segunda de dos: `project-admin` y `project-back` hacían la suya. De
 * ahí salió el defecto que nadie vio venir — lo guardado se llama
 * `templateHiddenRows` y aquí se leía `hiddenRows`, así que las filas que un
 * autor ocultaba en la plantilla reaparecían en la pantalla del diseñador.
 *
 * Ahora la traducción es una sola, la del paquete, y este módulo solo la
 * adapta a la forma que el diseñador usa en memoria.
 */

import { readTemplate } from "@rymel/design-template";
import type {
  TemplateCell,
  TemplateSheet as ContractSheet,
} from "@rymel/design-template";
import type { Template } from "../../commons/types";
import type { Cell, CellGrid, Sheet } from "./spreadsheet-types";

/** Un valor del elemento, tal como llega de la API externa. */
export interface ElementValue {
  key?: string;
  value?: unknown;
  type?: string;
}

/**
 * Celda del contrato a celda del diseñador.
 *
 * El contrato guarda el contenido en un campo y el formato aparte; el
 * diseñador los tiene planos. `computed` arranca vacío a propósito: el valor
 * se recalcula al cargar, y persistirlo en la plantilla era congelar un número
 * que su fórmula ya no produce.
 */
const toRuntimeCell = (cell: TemplateCell): Cell => {
  const format = cell.format ?? {};

  return {
    value: cell.content,
    formula: cell.content,
    computed: "",
    ...(format.bold === undefined ? {} : { bold: format.bold }),
    ...(format.textColor === undefined ? {} : { textColor: format.textColor }),
    ...(format.backgroundColor === undefined
      ? {}
      : { backgroundColor: format.backgroundColor }),
    ...(format.border === undefined ? {} : { border: format.border }),
    ...(format.borderTop === undefined ? {} : { borderTop: format.borderTop }),
    ...(format.borderRight === undefined
      ? {}
      : { borderRight: format.borderRight }),
    ...(format.borderBottom === undefined
      ? {}
      : { borderBottom: format.borderBottom }),
    ...(format.borderLeft === undefined
      ? {}
      : { borderLeft: format.borderLeft }),
    ...(format.decimals === undefined ? {} : { decimals: format.decimals }),
    ...(format.conditionalFormat === undefined
      ? {}
      : { conditionalFormat: format.conditionalFormat }),
    ...(cell.note === undefined ? {} : { note: cell.note }),
    ...(cell.options === undefined ? {} : { options: cell.options }),
    ...(cell.goTo === undefined ? {} : { goTo: cell.goTo }),
    ...(cell.itemLink === undefined
      ? {}
      : {
          itemLink: {
            catalogSheetId: cell.itemLink.catalogSheetName,
            catalogTableId: cell.itemLink.catalogTableId,
            itemId: cell.itemLink.itemId,
          },
        }),
    ...(cell.catalogConditionCells === undefined
      ? {}
      : { catalogConditionCells: cell.catalogConditionCells }),
    ...(cell.bomToggleNodeId === undefined
      ? {}
      : { bomToggleNodeId: cell.bomToggleNodeId }),
    ...(cell.materialTag === undefined
      ? {}
      : { materialTag: cell.materialTag }),
  };
};

/**
 * Rellena las celdas enlazadas a un dato del elemento.
 *
 * Su contenido en la plantilla es provisional: quien la escribió puso un valor
 * de ejemplo, y al cargarla manda el elemento.
 */
const applyElementValues = (
  cells: CellGrid,
  contractCells: Record<string, TemplateCell>,
  elementValues: readonly ElementValue[],
): CellGrid => {
  const result = { ...cells };

  for (const [ref, cell] of Object.entries(contractCells)) {
    if (!cell.elementKey) continue;

    const match = elementValues.find((value) => value.key === cell.elementKey);
    if (!match || match.value === undefined) continue;

    const text = String(match.value);
    const asNumber = Number(text);
    const computed =
      match.type === "number" && !Number.isNaN(asNumber) ? asNumber : text;

    result[ref] = { ...result[ref], value: text, formula: text, computed };
  }

  return result;
};

/** Hoja del contrato a hoja del diseñador. */
export const toRuntimeSheet = (
  sheet: ContractSheet,
  sheetId: string,
  elementValues: readonly ElementValue[] = [],
): Sheet => {
  const cells: CellGrid = {};
  for (const [ref, cell] of Object.entries(sheet.cells)) {
    cells[ref] = toRuntimeCell(cell);
  }

  return {
    id: sheetId,
    name: sheet.name,
    cells: applyElementValues(cells, sheet.cells, elementValues),
    columnWidths: { ...sheet.styles.columnWidths },
    rowHeights: { ...sheet.styles.rowHeights },
    // Lo que oculta la plantilla y lo que oculta el diseñador son cosas
    // distintas: lo segundo es estado de esta sesión y no viaja con la
    // plantilla ni se guarda en ella.
    templateHiddenRows: new Set<number>(sheet.styles.hiddenRows),
    templateHiddenColumns: new Set<number>(sheet.styles.hiddenColumns),
    userHiddenRows: new Set<number>(),
    userHiddenColumns: new Set<number>(),
    hiddenCells: new Set<string>(),
    freezeRow: sheet.styles.freezeRow,
    freezeColumn: sheet.styles.freezeColumn,
    mergedCells: sheet.styles.mergedCells,
    namedRanges: sheet.styles.namedRanges,
    semiFinishedZones: sheet.styles.semiFinishedZones,
    itemCatalogTables: sheet.styles.itemCatalogTables,
  };
};

/**
 * Las hojas de una plantilla, listas para el diseñador.
 *
 * Los valores calculados quedan vacíos: quien llame a esto tiene que
 * recalcular a continuación, que es lo que ya hacía `loadTemplate`.
 */
export const runtimeSheetsFromTemplate = (
  template: Template,
  instanceId: string,
  elementValues: readonly ElementValue[] = [],
): Sheet[] => {
  const document = readTemplate(template as Parameters<typeof readTemplate>[0]);

  return document.sheets.map((sheet, index) =>
    toRuntimeSheet(sheet, `${instanceId}-sheet${index + 1}`, elementValues),
  );
};
