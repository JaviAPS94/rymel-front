/**
 * Al añadir varios accesorios a la vez en la norma, todos llevan el
 * semielaborado y llegan a todos los elementos seleccionados, y así a la
 * lista de materiales.
 *
 * Antes solo el primero llevaba el semielaborado, y a los demás elementos
 * seleccionados solo se les añadía ese primero.
 *
 * Uso:
 *   npx tsx scripts/check-accessory-assignment.ts
 */

import type { Accessory } from "../src/commons/types";
import type { NormElement } from "../src/pages/NormPage";
import {
  addAccessoriesToElements,
  pickAccessories,
} from "../src/components/norms/accessoryAssignment";
import { buildBomSummaryCells } from "@rymel/design-template";

let failures = 0;
const check = (name: string, ok: boolean, detail = ""): void => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FALLA"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const BOBINA = { id: 7, name: "Bobina", code: "BOBINA" };
const catalog: Accessory[] = [
  { id: 601, reference: "06010504", description: "Indicador nivel aceite", unitOfMeasurement: "UND", averageCost: 10, lastCost: 11 },
  { id: 602, reference: "06010505", description: "Válvula de drenaje", unitOfMeasurement: "UND", averageCost: 20, lastCost: 21 },
  { id: 603, reference: "06010506", description: "Placa de características", unitOfMeasurement: "UND", averageCost: 30, lastCost: 31, value: 2 },
  { id: 604, reference: "06010507", description: "No elegido", unitOfMeasurement: "UND" },
];

const element = (sapReference: string): NormElement =>
  ({ sapReference, values: [] }) as unknown as NormElement;

const chosen = pickAccessories(catalog, [601, 602, 603], BOBINA);
check("se eligen los tres", chosen.length === 3);
check("los tres llevan el semielaborado", chosen.every((a) => a.semiFinished?.id === BOBINA.id));
check("cantidad 1 si no traen otra, y la suya si la traen", chosen.map((a) => a.value).join() === "1,1,2");
check("conservan los campos del ERP", chosen.every((a) => a.reference && a.unitOfMeasurement && a.lastCost));

const elements = [element("REF-A"), element("REF-B"), element("REF-C")];
addAccessoriesToElements(elements, ["REF-A", "REF-B"], chosen);
const accessoriesOf = (el: NormElement) =>
  (el.values.find((v) => v.key === "accesories")?.value as Accessory[] | undefined) ?? [];
check("los dos elementos seleccionados llevan los tres", accessoriesOf(elements[0]).length === 3 && accessoriesOf(elements[1]).length === 3);
check("el no seleccionado no cambia", elements[2].values.length === 0);

addAccessoriesToElements(elements, ["REF-A"], chosen);
check("añadir otra vez no los repite", accessoriesOf(elements[0]).length === 3);

// Y los tres aparecen en la lista bajo su semielaborado
const bom = { nodes: [{ id: 1, semiFinished: BOBINA, type: "STANDARD", parentId: null, children: [] }] };
const cells = buildBomSummaryCells(
  bom as never,
  new Set(),
  [],
  { values: elements[0].values } as never,
);
const items = Object.entries(cells)
  .filter(([ref]) => ref.startsWith("B") && Number(ref.slice(1)) > 2)
  .map(([, c]) => c.value);
check("la lista muestra los tres bajo Bobina", items.join() === "601,602,603", items.join());

console.log(failures === 0 ? "\nLos accesorios se asignan completos." : `\n${failures} comprobación(es) fallan`);
process.exit(failures === 0 ? 0 : 1);
