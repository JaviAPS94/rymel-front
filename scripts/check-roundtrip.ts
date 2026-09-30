/**
 * El otro extremo de la ida y vuelta.
 *
 * Carga la plantilla que `roundtrip-template.ts` publicó y leyó por la ruta de
 * la biblioteca, y comprueba dos cosas:
 *
 * 1. que llega íntegra —celdas, formato, combinaciones, regiones y filas
 *    ocultas—;
 * 2. que **los números que calcula el diseñador son los mismos que muestra la
 *    vista previa del editor**.
 *
 * Lo segundo no es una obviedad: el editor calcula celda a celda en orden de
 * dependencias con `evaluateCell`, y el diseñador resuelve el libro entero con
 * `evaluateSheet`. Son dos entradas distintas al mismo motor, y si no
 * coincidieran, lo que el autor ve al publicar no sería lo que el diseñador
 * obtiene.
 *
 *   npx tsx scripts/check-roundtrip.ts ../project-back/roundtrip-template.json
 */

import { readFileSync } from "node:fs";
import {
  buildGraph,
  buildRegistry,
  evaluateCell,
  evaluateSheet,
  getRecalcOrder,
  splitRef,
  type CellValueMap,
} from "@rymel/formula-engine";
import { isReadOnly } from "@rymel/design-template";
import { runtimeSheetsFromTemplate } from "../src/components/design/template-loading";
import { buildBomSummaryCells } from "../src/components/design/bom/buildBomSummary";
import { extractMaterialTagValues } from "../src/components/design/materialTagUtils";
import type { BomResponse, ElementResponse, Template } from "../src/commons/types";

let failures = 0;

const check = (name: string, condition: boolean, detail = ""): void => {
  console.log(`${condition ? "  ok  " : " FALLA"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
};

/** Cómo calcula el editor: celda a celda, en orden de dependencias. */
const editorValues = (book: Record<string, { formula: string }>): CellValueMap => {
  const graph = buildGraph(book);
  const { order, circular } = getRecalcOrder(graph, Object.keys(book));
  const registry = buildRegistry([]);
  const knownSheets = new Set(
    Object.keys(book)
      .map((ref) => splitRef(ref).sheet)
      .filter((name): name is string => name !== undefined),
  );
  const values: CellValueMap = {};

  const evaluate = (ref: string) => {
    const evaluation = evaluateCell(book[ref]?.formula ?? "", values, {
      sheet: splitRef(ref).sheet,
      knownSheets,
      customFunctions: registry,
    });
    values[ref] = evaluation.status === "ok" ? evaluation.value : "…";
  };

  const ordered = new Set(order);
  for (const ref of Object.keys(book)) if (!ordered.has(ref)) evaluate(ref);
  for (const ref of order) evaluate(ref);
  for (const ref of circular) values[ref] = "#CIRCULAR";

  return values;
};

const main = async (): Promise<void> => {
  // La ruta se resuelve desde este archivo, no desde el directorio actual.
  const path = process.argv[2] ?? "../../project-back/roundtrip-template.json";
  const template = JSON.parse(
    readFileSync(new URL(path, import.meta.url), "utf8"),
  ) as Template;

  console.log("\n--- llega íntegra");

  const sheets = runtimeSheetsFromTemplate(template, "design");
  check("dos hojas", sheets.length === 2);

  const tablas = sheets.find((sheet) => sheet.name === "Tablas")!;
  const resumen = sheets.find((sheet) => sheet.name === "Resumen")!;

  check(
    "la fila oculta de la plantilla se respeta",
    tablas.templateHiddenRows.has(7),
    [...tablas.templateHiddenRows].join(", "),
  );
  check(
    "lo que oculte el diseñador arranca vacío y es suyo",
    tablas.userHiddenRows.size === 0 && tablas.hiddenCells.size === 0,
  );
  check("el ancho de columna llega", tablas.columnWidths[0] === 140);
  check("la inmovilización llega", resumen.freezeRow === 1);
  check("la celda combinada llega", resumen.mergedCells.length === 1);
  check("el rango con nombre llega", (tablas.namedRanges ?? []).length === 1);
  check(
    "la tabla de catálogo llega",
    (tablas.itemCatalogTables ?? []).length === 1,
  );
  check(
    "la zona de semielaborado llega",
    (resumen.semiFinishedZones ?? []).length === 1,
  );
  check("el formato de celda llega", resumen.cells.A1?.bold === true);
  check("las opciones llegan", (resumen.cells.D1?.options ?? []).length === 2);
  check("la navegación llega", resumen.cells.D2?.goTo !== undefined);
  check("el enlace a ítem llega", resumen.cells.B5?.itemLink !== undefined);
  check(
    "la directiva de gráfico llega lista para dibujar",
    String(resumen.cells.K7?.value).startsWith("DRAW:FRONTAL:"),
    String(resumen.cells.K7?.value),
  );

  console.log("\n--- los números coinciden con los del editor");

  const book: Record<string, { formula: string }> = {};
  for (const sheet of sheets) {
    for (const [ref, cell] of Object.entries(sheet.cells)) {
      book[`${sheet.name}!${ref}`] = { formula: cell.formula };
    }
  }

  const designer = await evaluateSheet(book);
  const editor = editorValues(book);

  // `B3` busca 3000 en `Tablas!A2:Tablas!B3` con `;` y rango calificado en los
  // dos extremos: si algo de la migración se hubiera roto, se vería aquí.
  check(
    "la BUSCARV entre hojas da 9",
    designer.values["Resumen!B3"] === 9,
    String(designer.values["Resumen!B3"]),
  );
  check(
    "la fórmula que depende de ella da 18",
    designer.values["Resumen!B4"] === 18,
    String(designer.values["Resumen!B4"]),
  );

  const differences = Object.keys(book).filter(
    (ref) => String(designer.values[ref]) !== String(editor[ref]),
  );

  check(
    "el diseñador y el editor calculan lo mismo en todas las celdas",
    differences.length === 0,
    differences
      .slice(0, 5)
      .map(
        (ref) =>
          `${ref}: ${String(designer.values[ref])} vs ${String(editor[ref])}`,
      )
      .join(" | "),
  );

  console.log("\n--- lo que configura el admin, en el diseñador");

  check(
    "las etiquetas del catálogo llegan",
    JSON.stringify(tablas.itemCatalogTables?.[0]?.tags) === '["acero"]',
  );
  check(
    "las condiciones del vínculo llegan",
    JSON.stringify(resumen.cells.B5?.catalogConditionCells) === '["B6"]',
  );
  check(
    "la zona de solo lectura llega y protege B3:B4",
    isReadOnly(resumen, "B3") && isReadOnly(resumen, "B4") && !isReadOnly(resumen, "B5"),
  );

  // Con los valores calculados puestos, como los tiene el diseñador en pantalla.
  const calculated = sheets.map((sheet) => ({
    ...sheet,
    cells: Object.fromEntries(
      Object.entries(sheet.cells).map(([ref, cell]) => [
        ref,
        { ...cell, computed: designer.values[`${sheet.name}!${ref}`] ?? cell.computed },
      ]),
    ),
  }));

  const tags = extractMaterialTagValues(calculated);
  check(
    "el código de diseño toma MO y MD de la plantilla",
    tags.moValue === "3000" && tags.materialDevanadoValue === "18",
    JSON.stringify(tags),
  );

  const bom = {
    id: 1,
    code: "BOM",
    name: "BOM",
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
    nodes: [
      {
        id: 1,
        semiFinished: { id: 1, name: "BOBINA", code: "BOBINA" },
        type: "STANDARD",
        parentId: null,
        children: [],
      },
    ],
  } as unknown as BomResponse;
  const summary = buildBomSummaryCells(
    bom,
    new Set(),
    calculated,
    { values: [] } as unknown as ElementResponse,
  );
  const itemRow = ["B3", "C3", "D3", "E3"].map((ref) => summary[ref]?.value);
  check(
    "el resumen BOM lista el ítem vinculado con su cantidad",
    JSON.stringify(itemRow) === '["AC-1","Acero al silicio","18","kg"]',
    JSON.stringify(itemRow),
  );

  console.log(
    failures === 0
      ? "\nLa plantilla llega íntegra y calcula igual en los dos lados."
      : `\n${failures} comprobación(es) fallan.`,
  );

  process.exit(failures === 0 ? 0 : 1);
};

void main();
