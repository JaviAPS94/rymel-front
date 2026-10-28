/**
 * La lista del diseñador es la del admin, celda a celda.
 *
 * `buildBomSummary` vive en los dos repositorios. El admin fija su copia con
 * `client-bom-cases.json`; este script pasa los mismos casos por la copia del
 * cliente. Si falla, las dos listas divergieron y hay que igualarlas.
 *
 * Uso:
 *   npx tsx scripts/check-bom-parity.ts <ruta a client-bom-cases.json> [--write]
 *
 * Con `--write` reescribe las celdas esperadas de cada caso con la salida del
 * cliente: es como se regenera la línea base cuando una regla cambia a
 * propósito, en los dos repositorios a la vez.
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

const path = process.argv[2];
if (!path) {
  console.error("Falta la ruta a client-bom-cases.json");
  process.exit(2);
}

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
  console.log(failures === 0 ? "\nIgual que el admin" : `\n${failures} comprobación(es) fallan`);
  process.exit(failures === 0 ? 0 : 1);
};
main();
