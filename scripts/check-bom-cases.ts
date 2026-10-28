/**
 * La lista de materiales en los casos que importan, celda a celda.
 *
 * `fixtures/bom-cases.json` lleva los `sub_design` 90 y 91 con sus
 * semielaborados hijos plegados y desplegados, un ítem que ya no existe, un
 * catálogo borrado y los accesorios de la norma (completo con costos, sin
 * cantidad ni unidad, y con la unidad en `unitMeasurement`). También
 * comprueba la huella con la que se detecta que una lista ajustada quedó
 * vieja.
 *
 * Uso:
 *   npx tsx scripts/check-bom-cases.ts [--write]
 *
 * Con `--write` reescribe las celdas esperadas con la salida actual: es como
 * se regenera la línea base cuando una regla cambia a propósito.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { buildBomSummaryCells } from "../src/components/design/bom/buildBomSummary";
import { bomFingerprint } from "../src/components/design/bom/bomFingerprint";

type Case = {
  sheets: never[];
  expanded: number[];
  bom: never;
  element: never;
  cells: Record<string, unknown>;
};

const path = new URL("./fixtures/bom-cases.json", import.meta.url).pathname;

const cases = JSON.parse(readFileSync(path, "utf8")) as Record<string, Case>;
let failures = 0;

if (process.argv.includes("--write")) {
  for (const value of Object.values(cases)) {
    const cells = buildBomSummaryCells(value.bom, new Set(value.expanded), value.sheets, value.element);
    value.cells = JSON.parse(JSON.stringify(cells));
  }
  writeFileSync(path, `${JSON.stringify(cases, null, 2)}\n`);
  console.log(`Reescritos ${Object.keys(cases).length} casos en ${path}`);
}

for (const [name, value] of Object.entries(cases)) {
  const cells = buildBomSummaryCells(value.bom, new Set(value.expanded), value.sheets, value.element);
  // Ida y vuelta por JSON: el fixture no lleva `undefined`
  const ok = isDeepStrictEqual(JSON.parse(JSON.stringify(cells)), value.cells);
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FALLA"} ${name}`);
}

// La huella con la que se detecta que una lista ajustada quedó vieja
const main = async () => {
  const first = Object.values(cases)[0];
  const cells = buildBomSummaryCells(first.bom, new Set(first.expanded), first.sheets, first.element);
  const fingerprint = await bomFingerprint(cells);
  const reordered = Object.fromEntries(Object.entries(cells).reverse());
  const changed = { ...cells, D3: { ...cells.D3, value: "999", formula: "999", computed: "999" } };
  const checks: [string, boolean][] = [
    ["la huella es SHA-256 en hexadecimal", /^[0-9a-f]{64}$/.test(fingerprint)],
    ["la huella no depende del orden de las celdas", (await bomFingerprint(reordered)) === fingerprint],
    ["la huella cambia si cambia una celda", (await bomFingerprint(changed)) !== fingerprint],
  ];
  for (const [name, ok] of checks) {
    if (!ok) failures++;
    console.log(`  ${ok ? "ok  " : "FALLA"} ${name}`);
  }
  console.log(failures === 0 ? "\nIgual que la línea base" : `\n${failures} comprobación(es) fallan`);
  process.exit(failures === 0 ? 0 : 1);
};
main();
