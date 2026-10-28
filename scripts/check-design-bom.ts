/**
 * Lo que el diseñador ve y calcula a partir de la configuración de una hoja:
 * las marcas de sus celdas, las regiones, el código MO/MD y el resumen BOM.
 *
 * Existe para retirar del diseñador las acciones que **escriben** esa
 * configuración sin tocar lo que la **lee**. Se ejecuta una vez con
 * `--write` antes del recorte, y después sin argumentos: cualquier diferencia
 * con la línea base es una regresión.
 *
 * Cubre los dos únicos diseños guardados con BOM (`sub_design` 90 y 91) y la
 * plantilla que sirve la biblioteca. Los volcados salen de
 * `project-back/src/db/scripts/dump-bom-designs.ts` y
 * `dump-library-template.ts`.
 *
 *   npx tsx scripts/check-design-bom.ts [--write]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { buildBomSummaryCells } from "../src/components/design/bom/buildBomSummary";
import { extractMaterialTagValues } from "../src/components/design/materialTagUtils";
import { runtimeSheetsFromTemplate } from "../src/components/design/template-loading";
import type { BomNode, BomResponse, ElementResponse, Template } from "../src/commons/types";
import type { Sheet } from "../src/components/design/spreadsheet-types";

const fixture = (name: string): URL => new URL(`./fixtures/${name}`, import.meta.url);

/** Lo que una celda declara además de su contenido. */
const MARK_KEYS = [
  "materialTag",
  "itemLink",
  "catalogConditionCells",
  "goTo",
  "note",
  "options",
] as const;

const marksOf = (sheet: Sheet): Record<string, Record<string, unknown>> => {
  const marks: Record<string, Record<string, unknown>> = {};
  for (const ref of Object.keys(sheet.cells).sort()) {
    const cell = sheet.cells[ref] as unknown as Record<string, unknown>;
    const own: Record<string, unknown> = {};
    for (const key of MARK_KEYS) {
      if (cell[key] !== undefined) own[key] = cell[key];
    }
    if (Object.keys(own).length > 0) marks[ref] = own;
  }
  return marks;
};

/**
 * El BOM real llega de la API. Aquí basta con un árbol plano con un nodo por
 * semielaborado de las zonas: lo que se comprueba es cómo se leen las celdas,
 * no el árbol.
 */
const bomFor = (sheets: Sheet[]): BomResponse => {
  const ids = [
    ...new Set(
      sheets.flatMap((sheet) => (sheet.semiFinishedZones ?? []).map((z) => z.semiFinishedId)),
    ),
  ].sort((a, b) => a - b);
  const nodes = ids.map(
    (id, index) =>
      ({
        id: index + 1,
        semiFinished: { id, name: `SF ${id}`, code: `SF${id}` },
        type: "STANDARD",
        parentId: null,
        children: [],
      }) as unknown as BomNode,
  );
  return {
    id: 1,
    code: "BOM",
    name: "BOM",
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
    nodes,
  };
};

const ELEMENT = { values: [] } as unknown as ElementResponse;

const snapshot = (sheets: Sheet[]) => ({
  sheets: sheets.map((sheet) => ({
    name: sheet.name,
    marks: marksOf(sheet),
    namedRanges: sheet.namedRanges ?? [],
    semiFinishedZones: sheet.semiFinishedZones ?? [],
    itemCatalogTables: sheet.itemCatalogTables ?? [],
    mergedCells: sheet.mergedCells ?? [],
    freeze: [sheet.freezeRow ?? 0, sheet.freezeColumn ?? 0],
  })),
  materialTags: extractMaterialTagValues(sheets),
  bomSummary: Object.fromEntries(
    Object.entries(buildBomSummaryCells(bomFor(sheets), new Set(), sheets, ELEMENT))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ref, cell]) => [ref, cell.value]),
  ),
});

const designs = JSON.parse(readFileSync(fixture("bom-designs.json"), "utf8")) as {
  id: number;
  sheet: Sheet;
}[];
const library = JSON.parse(
  readFileSync(fixture("library-TEMPLATE_1F_0001.json"), "utf8"),
) as Template;

const current = {
  ...Object.fromEntries(
    designs.map((design) => [`sub_design ${design.id}`, snapshot([design.sheet])]),
  ),
  TEMPLATE_1F_0001: snapshot(runtimeSheetsFromTemplate(library, "design")),
};

const baselineFile = fixture("bom-baseline.json");

if (process.argv.includes("--write")) {
  writeFileSync(baselineFile, JSON.stringify(current, null, 1));
  for (const [name, value] of Object.entries(current)) {
    const marks = value.sheets.reduce((n, s) => n + Object.keys(s.marks).length, 0);
    console.log(
      `${name}: ${marks} celdas con marcas, MO/MD ${JSON.stringify(value.materialTags)}, ` +
        `${Object.keys(value.bomSummary).length} celdas de resumen BOM`,
    );
  }
  console.log(`\nLínea base escrita en ${baselineFile.pathname}`);
} else {
  const baseline = JSON.parse(readFileSync(baselineFile, "utf8")) as typeof current;
  let failures = 0;
  for (const name of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    const same =
      JSON.stringify(baseline[name as keyof typeof baseline]) ===
      JSON.stringify(current[name as keyof typeof current]);
    console.log(`${same ? "  ok  " : " FALLA"} ${name}`);
    if (!same) failures++;
  }
  if (failures > 0) {
    console.log(`\n${failures} diferencia(s) con la línea base`);
    process.exit(1);
  }
  console.log("\nIgual que la línea base");
}
