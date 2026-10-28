/**
 * Un diseño creado con una plantilla con lista de materiales base, de punta a
 * punta en el lado del diseñador.
 *
 * La plantilla lleva una hoja con un ítem vinculado y la hoja base que genera
 * el administrador. Se carga como la carga el diseñador, se cambia un valor
 * (como al editar el diseño, que solo recalcula la hoja activa), y la lista
 * de la pestaña —base calculada más accesorios— tiene que dar el valor nuevo
 * y los accesorios del elemento en su sección.
 *
 * Uso:
 *   npx tsx scripts/check-bom-base.ts
 */

import {
  bomFingerprint,
  buildBomBaseSheet,
  emptySheetStyles,
  evaluateBomBase,
  withAccessories,
  writeSheet,
  type TemplateSheet,
} from "@rymel/design-template";
import { runtimeSheetsFromTemplate } from "../src/components/design/template-loading";
import type { Template } from "../src/commons/types";

let failures = 0;
const check = (name: string, ok: boolean, detail = ""): void => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FALLA"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const HOJA: TemplateSheet = {
  name: "Hoja1",
  position: 0,
  cells: {
    B2: { content: "Item" },
    B3: { content: "240" },
    C3: { content: "Fibra de 2 mm" },
    D3: { content: "KLS" },
    L4: { content: "1.5" },
    L5: { content: "=L4*2", itemLink: { catalogSheetName: "Hoja1", catalogTableId: "cat", itemId: "240" } },
  },
  styles: {
    ...emptySheetStyles(),
    semiFinishedZones: [
      { id: "z1", semiFinishedId: 1, semiFinishedCode: "SF1", semiFinishedName: "SF 1", startCell: "L5", endCell: "L5" },
    ],
    itemCatalogTables: [
      { id: "cat", name: "Catálogo", startCell: "B2", endCell: "D3", headerRows: 1, idColumnOffset: 0, descriptionColumnOffset: 1, umColumnOffset: 2 },
    ],
  },
};
const STRUCTURE = {
  id: 2,
  code: "1-25-220-120",
  name: "Estructura de prueba",
  nodes: [{ id: 10, semiFinished: { id: 1, name: "SF 1", code: "SF1" }, children: [] }],
};
const ELEMENT = {
  values: [
    {
      key: "accesories",
      value: [
        { id: 601, reference: "06010504", description: "Indicador nivel aceite", unitOfMeasurement: "UND", averageCost: 10, lastCost: 11, value: 2, semiFinished: { id: 1 } },
      ],
    },
  ],
};

const main = async () => {
  // El admin genera la base y añade una fila fija
  const base = buildBomBaseSheet(STRUCTURE, [HOJA]);
  const lastRow = Math.max(...Object.keys(base.cells).map((ref) => Number(ref.replace(/^[A-Z]+/, ""))));
  base.cells[`B${lastRow + 1}`] = { content: "BARNIZ" };
  base.cells[`C${lastRow + 1}`] = { content: "Barniz dieléctrico" };
  base.cells[`D${lastRow + 1}`] = { content: "2" };

  const template = {
    id: 1,
    name: "Con base",
    code: "TPL_BASE",
    description: "",
    sheets: [writeSheet(HOJA), writeSheet(base)],
  } as unknown as Template;

  console.log("\n--- carga de la plantilla");
  const sheets = runtimeSheetsFromTemplate(template, "default");
  const runtimeBase = sheets.find((sheet) => sheet.billOfMaterials);
  check("la hoja base llega marcada", runtimeBase?.billOfMaterials?.structureCode === "1-25-220-120");
  check("y queda fuera de las pestañas de hojas", sheets.filter((sheet) => !sheet.billOfMaterials).map((s) => s.name).join() === "Hoja1");
  check("las demás hojas no llevan la marca", !sheets.find((s) => s.name === "Hoja1")?.billOfMaterials);

  console.log("\n--- el diseño cambia un valor");
  // Al cargar se calculó L5 = 3; el diseñador cambia L4 y se recalcula solo Hoja1
  const hoja = sheets.find((sheet) => sheet.name === "Hoja1")!;
  hoja.cells.L4 = { ...hoja.cells.L4!, value: "3.5", formula: "3.5", computed: 3.5 };
  hoja.cells.L5 = { ...hoja.cells.L5!, computed: 7 };
  for (const cell of Object.values(runtimeBase!.cells)) {
    if (cell.formula?.startsWith("=")) cell.computed = "viejo";
  }

  const list = withAccessories(await evaluateBomBase(runtimeBase!, sheets), ELEMENT);
  const rowOf = (item: string) =>
    Object.entries(list).find(([ref, cell]) => ref.startsWith("B") && cell.value === item)?.[0].slice(1);
  const item = rowOf("240");
  check("la cantidad es la del diseño, no la guardada", list[`D${item}`]?.value === "7", String(list[`D${item}`]?.value));
  check("descripción y unidad desde el catálogo", list[`C${item}`]?.value === "Fibra de 2 mm" && list[`E${item}`]?.value === "KLS");
  // La fila fija del admin quedó pegada al ítem: es parte de la sección SF 1
  const fixed = rowOf("BARNIZ");
  check("la fila fija del admin sigue en su sitio", fixed === String(lastRow + 1) && list[`D${fixed}`]?.value === "2");
  const accessory = rowOf("601");
  check("el accesorio va al final de su sección, tras las filas de la base", Number(accessory) === Number(fixed) + 1, `fila ${accessory}`);
  check("con todos sus campos", list[`F${accessory}`]?.value === "06010504" && list[`G${accessory}`]?.value === "10");
  check("nada quedó con el valor guardado viejo", !Object.values(list).some((cell) => cell.value === "viejo"));

  console.log("\n--- huella");
  const fingerprint = bomFingerprint(list as Parameters<typeof bomFingerprint>[0]);
  hoja.cells.L5 = { ...hoja.cells.L5!, computed: 8 };
  const changed = bomFingerprint(withAccessories(await evaluateBomBase(runtimeBase!, sheets), ELEMENT) as Parameters<typeof bomFingerprint>[0]);
  check("cambia si cambia un valor del diseño", fingerprint !== changed);

  console.log(failures === 0 ? "\nLa lista parte de la base de la plantilla." : `\n${failures} comprobación(es) fallan`);
  process.exit(failures === 0 ? 0 : 1);
};
main();
