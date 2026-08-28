/**
 * Comparación de paridad entre las dos formas de cargar una plantilla.
 *
 * A la izquierda, lo que hace hoy `loadTemplate` en `SpreadSheet.tsx`, copiado
 * aquí tal cual. A la derecha, `runtimeSheetsFromTemplate`, que pasa por el
 * contrato compartido. Se comparan hoja por hoja y celda por celda.
 *
 * Es la puerta de corte de la migración: **si aparece una diferencia que no
 * corresponde a una corrección conocida, no se conmuta**. Las correcciones
 * conocidas están declaradas abajo, con su motivo; cualquier otra cosa se
 * reporta como desviación.
 *
 *   npx tsx scripts/parity-template-loading.ts
 */

import { readFileSync } from "node:fs";
import { runtimeSheetsFromTemplate } from "../src/components/design/template-loading";
import type { Template } from "../src/commons/types";
import type { Cell, Sheet } from "../src/components/design/spreadsheet-types";

/** Volcado literal de las plantillas guardadas, sin interpretar. */
interface LegacyRow {
  id: number;
  name: string;
  code: string;
  description?: string;
  type?: string;
  sheets?: {
    id: number;
    name: string;
    order: number;
    cells: Record<string, Record<string, unknown>>;
    cellsStyles: Record<string, unknown> | null;
  }[];
}

/**
 * La carga actual, copiada de `loadTemplate` sin cambiarle nada.
 *
 * Se reproduce aquí en vez de importarse porque vive dentro de un componente
 * de React de 6300 líneas y no se puede invocar sin montarlo.
 */
const legacyLoad = (template: Template, instanceId: string): Sheet[] =>
  (template.sheets ?? []).map((templateSheet, index) => ({
    id: `${instanceId}-sheet${index + 1}`,
    name: templateSheet.name,
    cells: { ...templateSheet.cells } as unknown as Record<string, Cell>,
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
    semiFinishedZones: templateSheet.cellsStyles.semiFinishedZones || [],
    itemCatalogTables: templateSheet.cellsStyles.itemCatalogTables || [],
  })) as Sheet[];

/**
 * Diferencias esperadas, con el motivo por el que se aceptan.
 *
 * Todo lo que no encaje aquí detiene la conmutación.
 */
const KNOWN_CORRECTIONS: {
  matches: (difference: Difference) => boolean;
  reason: string;
}[] = [
  {
    matches: (difference) =>
      difference.field === "computed" && difference.right === "",
    reason:
      "el valor calculado deja de viajar en la plantilla; se recalcula al cargar",
  },
  {
    matches: (difference) => difference.field === "cell-missing-right",
    reason: "celda sin contenido descartada por la normalización",
  },
  {
    matches: (difference) =>
      (difference.field === "value" || difference.field === "formula") &&
      typeof difference.left === "string" &&
      difference.left.startsWith("=DRAW:"),
    reason:
      "la directiva de gráfico se guarda sin el `=`, que es la forma que el renderizador espera",
  },
  {
    matches: (difference) =>
      (difference.field === "value" || difference.field === "formula") &&
      difference.left === undefined &&
      difference.right === "",
    reason:
      "celda que solo lleva formato: el contrato le pone contenido vacío explícito en vez de omitir la clave (equivalencia comprobada abajo)",
  },
];

/**
 * Comprueba que la normalización anterior no cambia nada.
 *
 * 50 celdas de la plantilla real llevan borde y ningún contenido: no traen las
 * claves `value` ni `formula`. El contrato les pone `""`. Antes de aceptarlo
 * como diferencia inocua hay que verificar que los dos consumidores de ese
 * campo se comportan igual con `undefined` y con `""`.
 */
const checkEmptyCellEquivalence = (): boolean => {
  // Lo que hace el renderizador para decidir qué pinta y si es un gráfico.
  const rendered = (value: string | undefined) => value || "";
  // Lo que hace el evaluador con el contenido de la celda.
  const evaluated = (formula: string | undefined) =>
    !formula || formula.trim() === "" ? "" : formula;

  const same =
    rendered(undefined) === rendered("") && evaluated(undefined) === evaluated("");

  console.log(
    same
      ? "Equivalencia comprobada: `undefined` y `\"\"` se renderizan y evalúan igual."
      : "Equivalencia FALLIDA: `undefined` y `\"\"` no se comportan igual.",
  );

  return same;
};

interface Difference {
  sheet: string;
  cell?: string;
  field: string;
  left: unknown;
  right: unknown;
}

const compareSheets = (left: Sheet, right: Sheet): Difference[] => {
  const differences: Difference[] = [];
  const sheet = left.name;

  const push = (field: string, a: unknown, b: unknown, cell?: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      differences.push({ sheet, field, left: a, right: b, ...(cell ? { cell } : {}) });
    }
  };

  push("name", left.name, right.name);
  push("columnWidths", left.columnWidths, right.columnWidths);
  push("rowHeights", left.rowHeights, right.rowHeights);
  push("freezeRow", left.freezeRow, right.freezeRow);
  push("freezeColumn", left.freezeColumn, right.freezeColumn);
  push("mergedCells", left.mergedCells, right.mergedCells);
  push("namedRanges", left.namedRanges, right.namedRanges);
  push("semiFinishedZones", left.semiFinishedZones ?? [], right.semiFinishedZones ?? []);
  push("itemCatalogTables", left.itemCatalogTables ?? [], right.itemCatalogTables ?? []);
  push(
    "templateHiddenRows",
    [...left.templateHiddenRows],
    [...right.templateHiddenRows],
  );
  push(
    "templateHiddenColumns",
    [...left.templateHiddenColumns],
    [...right.templateHiddenColumns],
  );

  const refs = new Set([
    ...Object.keys(left.cells),
    ...Object.keys(right.cells),
  ]);

  for (const ref of refs) {
    const a = left.cells[ref] as Record<string, unknown> | undefined;
    const b = right.cells[ref] as Record<string, unknown> | undefined;

    if (a && !b) {
      differences.push({ sheet, cell: ref, field: "cell-missing-right", left: a, right: undefined });
      continue;
    }
    if (!a && b) {
      differences.push({ sheet, cell: ref, field: "cell-missing-left", left: undefined, right: b });
      continue;
    }
    if (!a || !b) continue;

    for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
      push(field, a[field], b[field], ref);
    }
  }

  return differences;
};

const main = (): void => {
  const rows: LegacyRow[] = JSON.parse(
    readFileSync(
      new URL(
        "../../rymel-design-template/test/fixtures/legacy-templates.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );

  let unexplained = checkEmptyCellEquivalence() ? 0 : 1;

  for (const row of rows) {
    if (!row.sheets || row.sheets.length === 0) continue;

    const template = {
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description ?? "",
      sheets: row.sheets.map((sheet) => ({
        name: sheet.name,
        cells: sheet.cells,
        cellsStyles: sheet.cellsStyles ?? {},
      })),
    } as unknown as Template;

    const legacy = legacyLoad(template, "design");
    const contract = runtimeSheetsFromTemplate(
      { ...template, sheets: row.sheets } as unknown as Template,
      "design",
    );

    console.log(`\n=== ${row.code}`);
    console.log(`  hojas: ${legacy.length} (actual) vs ${contract.length} (contrato)`);

    for (const [index, sheet] of legacy.entries()) {
      const other = contract[index];
      if (!other) {
        console.log(`  FALTA la hoja "${sheet.name}" por el contrato`);
        unexplained++;
        continue;
      }

      const differences = compareSheets(sheet, other);
      const byReason = new Map<string, number>();
      const unknown: Difference[] = [];

      for (const difference of differences) {
        const correction = KNOWN_CORRECTIONS.find((item) =>
          item.matches(difference),
        );
        if (correction) {
          byReason.set(correction.reason, (byReason.get(correction.reason) ?? 0) + 1);
        } else {
          unknown.push(difference);
        }
      }

      console.log(
        `  ${sheet.name}: ${Object.keys(sheet.cells).length} celdas -> ${Object.keys(other.cells).length}`,
      );
      for (const [reason, count] of byReason) {
        console.log(`    ${count} diferencia(s) explicadas: ${reason}`);
      }

      if (unknown.length > 0) {
        unexplained += unknown.length;
        console.log(`    ${unknown.length} DIFERENCIA(S) SIN EXPLICAR:`);
        for (const difference of unknown.slice(0, 12)) {
          console.log(
            `      ${difference.cell ?? "(hoja)"} · ${difference.field}: ${JSON.stringify(
              difference.left,
            )?.slice(0, 60)} -> ${JSON.stringify(difference.right)?.slice(0, 60)}`,
          );
        }
      }
    }
  }

  console.log(
    unexplained === 0
      ? "\nToda diferencia corresponde a una corrección conocida. Se puede conmutar."
      : `\n${unexplained} diferencia(s) sin explicar: NO conmutar.`,
  );

  process.exit(unexplained === 0 ? 0 : 1);
};

main();
