/**
 * El rastreo de celdas del diseñador explica cada celda igual que el editor de
 * plantillas del administrador.
 *
 * Carga la plantilla real de la biblioteca como lo hace el diseñador y, para
 * cada celda, compara su rastreo sobre las hojas del diseño con el del
 * administrador sobre la plantilla. Luego prueba lo que la pantalla necesita:
 * dependientes en otra hoja, la cadena completa, y que una celda editada en el
 * diseño cambia el rastreo.
 *
 *   npx tsx scripts/check-cell-trace.ts
 */

import { readFileSync } from "node:fs";
import { buildGraph } from "@rymel/formula-engine";
import {
  readTemplate,
  templateCellLookup,
  toEngineBook,
  traceCell,
  type CellTrace,
} from "@rymel/design-template";
import { runtimeSheetsFromTemplate } from "../src/components/design/template-loading";
import { designBook, traceDesignCell } from "../src/components/design/cell-trace";
import type { Template } from "../src/commons/types";

let failures = 0;
const check = (name: string, condition: boolean, detail = ""): void => {
  console.log(`${condition ? "  ok  " : " FALLA"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
};

const library = JSON.parse(
  readFileSync(new URL("./fixtures/library-TEMPLATE_1F_0001.json", import.meta.url), "utf8"),
) as Template;

const template = readTemplate(library as Parameters<typeof readTemplate>[0]);
const sheets = runtimeSheetsFromTemplate(library, "design");
const adminGraph = buildGraph(toEngineBook(template));
const designGraph = buildGraph(designBook(sheets));

/** Lo comparable de un rastreo: sin los `Set`, que no se comparan por JSON */
const comparable = (trace: CellTrace) =>
  JSON.stringify({
    precedents: trace.precedents,
    dependents: trace.dependents,
    highlight: [[...trace.highlight.precedents].sort(), [...trace.highlight.dependents].sort()],
    chain: trace.chain,
    circular: trace.circular,
  });

console.log("\n--- el mismo rastreo que el administrador, celda por celda");
let compared = 0;
const differing: string[] = [];
for (const sheet of template.sheets) {
  for (const [ref, cell] of Object.entries(sheet.cells)) {
    // Las celdas con dato del elemento se ven distinto a propósito: el diseño
    // ya tiene el valor copiado y no sabe de qué dato salió
    if (cell.elementKey) continue;
    compared++;
    const admin = traceCell(templateCellLookup(template), adminGraph, sheet.name, ref, { full: true });
    const design = traceDesignCell(sheets, designGraph, sheet.name, ref, { full: true });
    const same = (a: CellTrace, b: CellTrace) =>
      comparable({ ...a, chain: a.chain?.map((level) => level.map(({ elementKey: _, ...node }) => ({ ...node, origin: node.origin === "element" ? "literal" : node.origin }))) }) ===
      comparable({ ...b, chain: b.chain?.map((level) => level.map(({ elementKey: _, ...node }) => ({ ...node, origin: node.origin === "element" ? "literal" : node.origin }))) });
    if (!same(admin, design)) differing.push(`${sheet.name}!${ref}`);
  }
}
check(
  `${compared} celdas: el diseñador las rastrea como el administrador`,
  differing.length === 0,
  differing.slice(0, 5).join(", "),
);

console.log("\n--- lo que la pantalla necesita");
const g17 = traceDesignCell(sheets, designGraph, "Resumen", "G17");
check(
  "G17, la fórmula real, lee una tabla de otra hoja",
  g17.precedents.some((item) => item.sheet === "Tablas"),
  JSON.stringify(g17.precedents),
);
const tablas = sheets.find((sheet) => sheet.name === "Tablas")!;
const readByResumen = Object.keys(tablas.cells).find((ref) =>
  traceDesignCell(sheets, designGraph, "Tablas", ref).dependents.some((item) => item.sheet === "Resumen"),
);
check("una celda de Tablas muestra sus dependientes en Resumen", readByResumen !== undefined, readByResumen);
const chain = traceDesignCell(sheets, designGraph, "Resumen", "G17", { full: true }).chain ?? [];
check(
  "la cadena completa de G17 llega a valores escritos",
  chain.length > 0 && chain.flat().some((node) => node.origin === "literal"),
  `${chain.length} niveles, ${chain.flat().length} celdas`,
);

console.log("\n--- una celda editada en el diseño cambia el rastreo");
const edited = sheets.map((sheet) =>
  sheet.name === "Resumen"
    ? { ...sheet, cells: { ...sheet.cells, Z99: { value: "", formula: "=G17*2", computed: "" } } }
    : sheet,
);
const afterEdit = traceDesignCell(edited, buildGraph(designBook(edited)), "Resumen", "G17");
check(
  "G17 ahora tiene a Z99 entre sus dependientes",
  afterEdit.dependents.some((item) => item.sheet === "Resumen" && item.ref === "Z99"),
);

console.log("\n--- una celda con valor y sin fórmula, como deja un desplegable");
const withDropdown = edited.map((sheet) =>
  sheet.name === "Resumen"
    ? { ...sheet, cells: { ...sheet.cells, Y1: { value: "7", formula: "", computed: "" }, Y2: { value: "", formula: "=Y1+1", computed: "" } } }
    : sheet,
);
const y2 = traceDesignCell(withDropdown, buildGraph(designBook(withDropdown)), "Resumen", "Y2", { full: true });
check(
  "la cadena la muestra como valor, no como vacía",
  JSON.stringify(y2.chain) === JSON.stringify([[{ sheet: "Resumen", ref: "Y1", origin: "literal" }]]),
  JSON.stringify(y2.chain),
);

console.log("\n--- tiempo");
const start = performance.now();
buildGraph(designBook(sheets));
traceDesignCell(sheets, designGraph, "Resumen", "G17", { full: true });
const ms = performance.now() - start;
check("armar el grafo del libro y rastrear G17 cuesta menos de 100 ms", ms < 100, `${ms.toFixed(1)} ms`);

console.log(failures === 0 ? "\nTodo bien." : `\n${failures} comprobación(es) fallida(s).`);
process.exit(failures === 0 ? 0 : 1);
