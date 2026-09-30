/**
 * Las zonas de solo lectura llegan al diseñador y viajan con el diseño.
 *
 * Toma la plantilla que sirve la biblioteca, le añade una zona y una
 * combinación, y comprueba el recorrido de datos que la interfaz no puede
 * probar por sí sola: que la carga las trae a la hoja del diseñador, que la
 * regla del contrato decide igual sobre esa hoja —con sus `Set` y su forma
 * propia—, y que sobreviven al guardado y a la reapertura tal como las hace
 * `ElementsDesignPage`.
 *
 *   npx tsx scripts/check-read-only.ts
 */

import { readFileSync } from "node:fs";
import { isReadOnly } from "@rymel/design-template";
import { runtimeSheetsFromTemplate } from "../src/components/design/template-loading";
import type { Template } from "../src/commons/types";
import type { Sheet } from "../src/components/design/spreadsheet-types";

let failures = 0;
const check = (name: string, condition: boolean, detail = ""): void => {
  console.log(`${condition ? "  ok  " : " FALLA"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
};

const library = JSON.parse(
  readFileSync(new URL("./fixtures/library-TEMPLATE_1F_0001.json", import.meta.url), "utf8"),
) as Template & { sheets: { name: string; cellsStyles: Record<string, unknown> }[] };

const ZONE = { id: "ro-1", startCell: "G13", endCell: "G17" };
const resumen = library.sheets.find((sheet) => sheet.name === "Resumen")!;
resumen.cellsStyles = {
  ...resumen.cellsStyles,
  readOnlyZones: [ZONE],
  mergedCells: [
    ...((resumen.cellsStyles.mergedCells as unknown[]) ?? []),
    { startCell: "G13", endCell: "H13", rowSpan: 1, colSpan: 2 },
  ],
};

console.log("\n--- carga");
const sheets = runtimeSheetsFromTemplate(library, "design");
const sheet = sheets.find((item) => item.name === "Resumen")!;
check("la hoja del diseñador trae la zona", JSON.stringify(sheet.readOnlyZones) === JSON.stringify([ZONE]));
check("la otra hoja no trae ninguna", (sheets.find((item) => item.name === "Tablas")!.readOnlyZones ?? []).length === 0);

console.log("\n--- la regla del contrato sobre la hoja del diseñador");
check("G17, la fórmula real, está protegida", isReadOnly(sheet, "G17"));
check("G13 está protegida", isReadOnly(sheet, "G13"));
check("H13 está protegida por su combinación con G13", isReadOnly(sheet, "H13"));
check("G18 queda fuera", !isReadOnly(sheet, "G18"));
check("F17 queda fuera", !isReadOnly(sheet, "F17"));

console.log("\n--- guardar y reabrir, como ElementsDesignPage");
// Guardar: la hoja se esparce entera y los `Set` pasan a arreglos.
const saved = JSON.parse(
  JSON.stringify({
    ...sheet,
    templateHiddenRows: Array.from(sheet.templateHiddenRows || []),
    templateHiddenColumns: Array.from(sheet.templateHiddenColumns || []),
    userHiddenRows: Array.from(sheet.userHiddenRows || []),
    userHiddenColumns: Array.from(sheet.userHiddenColumns || []),
    hiddenCells: Array.from(sheet.hiddenCells || []),
  }),
);
check("el dato guardado lleva la zona", JSON.stringify(saved.readOnlyZones) === JSON.stringify([ZONE]));

// Reabrir: `normalizeSheet` esparce el dato guardado y rehace los `Set`.
const reopened: Sheet = {
  ...saved,
  templateHiddenRows: new Set(saved.templateHiddenRows),
  templateHiddenColumns: new Set(saved.templateHiddenColumns),
  userHiddenRows: new Set(saved.userHiddenRows),
  userHiddenColumns: new Set(saved.userHiddenColumns),
  hiddenCells: new Set(saved.hiddenCells),
  mergedCells: saved.mergedCells || [],
  namedRanges: saved.namedRanges || [],
};
check("reabierto, G17 sigue protegida", isReadOnly(reopened, "G17"));
check("reabierto, H13 sigue protegida", isReadOnly(reopened, "H13"));

console.log(failures === 0 ? "\nLas zonas llegan y viajan con el diseño." : `\n${failures} comprobación(es) fallan.`);
if (failures > 0) process.exit(1);
