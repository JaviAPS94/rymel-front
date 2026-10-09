/**
 * Las formas en que `element.values` llega de verdad.
 *
 * El servidor lo guarda como texto JSON y lo devuelve de dos maneras según el
 * camino: arreglo desde el catálogo de elementos, cadena desde la respuesta de
 * un diseño. `buildBomSummary` asumía siempre arreglo y por eso la lista de
 * materiales fallaba con `element.values.find is not a function`.
 *
 *   npx tsx scripts/check-element-values.ts
 */

import { parseElementValues } from "../src/commons/functions";

const casos: [string, unknown][] = [
  ["arreglo (catálogo de elementos)", [{ key: "accesories", value: "[]" }]],
  ["texto JSON (respuesta de diseño)", '[{"key":"accesories","value":"[]"}]'],
  ["texto vacío", ""],
  ["texto inválido", "{no es json"],
  ["nulo", null],
  ["indefinido", undefined],
  ["objeto suelto", { key: "accesories" }],
];

for (const [nombre, valor] of casos) {
  const r = parseElementValues(valor);
  const accEntry = r.find((v) => v["key"] === "accesories");
  console.log(
    `${nombre.padEnd(34)} → ${Array.isArray(r) ? "arreglo" : "?"} (${r.length}) · accesories ${accEntry ? "encontrado" : "no"}`,
  );
}
