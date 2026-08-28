/**
 * Comprobación de la carga de una plantilla, de punta a punta.
 *
 * Reproduce lo que hace el diseñador al elegir una plantilla: la traduce con
 * el contrato compartido y la recalcula con el motor. Comprueba los tres
 * defectos que este cambio venía a corregir y que se veían al abrir
 * `TEMPLATE_1F_0001`:
 *
 * - `G17` daba `#ERROR` porque su `BUSCARV` usa `;` y un rango calificado en
 *   los dos extremos.
 * - `C6` daba `#ERROR` por lo mismo, aunque tiene además una causa propia.
 * - el dibujo de `K73` desaparecía, porque su `computed` se sobrescribía con
 *   `#ERROR` y es de ahí de donde el renderizador lo sacaba.
 *
 *   npx tsx scripts/check-template-load.ts
 */

import { readFileSync } from "node:fs";
import { evaluateSheet } from "@rymel/formula-engine";
import { runtimeSheetsFromTemplate } from "../src/components/design/template-loading";
import type { Template } from "../src/commons/types";

let failures = 0;

const check = (name: string, condition: boolean, detail = ""): void => {
  console.log(`${condition ? "  ok  " : " FALLA"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
};

/**
 * Por omisión, el volcado literal de lo que había antes de sanear. Con un
 * argumento, cualquier otro fichero —por ejemplo el que sirve la biblioteca
 * ya normalizado, para comprobar que no hay regresión.
 */
const source = process.argv[2];

const templates = source
  ? [JSON.parse(readFileSync(new URL(source, import.meta.url), "utf8"))]
  : (JSON.parse(
      readFileSync(
        new URL(
          "../../rymel-design-template/test/fixtures/legacy-templates.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { code: string; sheets?: unknown[] }[]);

const main = async (): Promise<void> => {
  const row = templates.find((item) => item.code === "TEMPLATE_1F_0001")!;
  const sheets = runtimeSheetsFromTemplate(row as unknown as Template, "design");

  console.log(`\n--- traducción por el contrato`);
  check("carga las dos hojas", sheets.length === 2);
  check(
    "las nombra igual",
    JSON.stringify(sheets.map((sheet) => sheet.name)) === '["Resumen","Tablas"]',
  );

  const resumen = sheets[0];

  // La directiva del gráfico llega en el propio contenido de la celda. Antes
  // llegaba con `=` y el renderizador tenía que sacarla del valor calculado,
  // que es justo lo que se perdía al recalcular.
  check(
    "la celda de gráfico llega sin el `=`",
    typeof resumen.cells.K73?.value === "string" &&
      resumen.cells.K73.value.startsWith("DRAW:BOBINADO:"),
    String(resumen.cells.K73?.value).slice(0, 40),
  );

  check(
    "el estado de ocultamiento del diseñador arranca vacío",
    resumen.userHiddenRows.size === 0 &&
      resumen.userHiddenColumns.size === 0 &&
      resumen.hiddenCells.size === 0,
  );

  console.log(`\n--- recálculo con el motor`);

  // El libro plano de toda la plantilla, como lo entiende el motor.
  const book: Record<string, { formula: string }> = {};
  for (const sheet of sheets) {
    for (const [ref, cell] of Object.entries(sheet.cells)) {
      book[`${sheet.name}!${ref}`] = { formula: cell.formula };
    }
  }

  const result = await evaluateSheet(book);

  check(
    "G17 vuelve a dar los 20 que tenía guardados",
    result.values["Resumen!G17"] === 20,
    String(result.values["Resumen!G17"]),
  );

  check(
    "el dibujo de K73 sobrevive al recálculo",
    String(result.values["Resumen!K73"]).startsWith("DRAW:BOBINADO:"),
    String(result.values["Resumen!K73"]).slice(0, 40),
  );

  // `T28` y `T29` leen `Tablas!C231` y `C232`, que guardan `0,022` y `0,026`:
  // decimales escritos con coma. Ni este evaluador ni el anterior los entienden
  // como números — el anterior los truncaba a `0` en silencio, éste devuelve el
  // texto tal cual—. Es un problema del dato, no de la carga, y se comprueba
  // aquí para que quede a la vista.
  check(
    "T28 y T29 leen de la otra hoja",
    result.values["Resumen!T28"] === "0,022" &&
      result.values["Resumen!T29"] === "0,026",
    `${String(result.values["Resumen!T28"])} / ${String(result.values["Resumen!T29"])}`,
  );

  check(
    "I39 reproduce su valor guardado",
    result.values["Resumen!I39"] === 1.4224751066856327,
    String(result.values["Resumen!I39"]),
  );

  // `C6` sigue en error, y no por el motor: su tabla de consulta está a medio
  // escribir y el cuarto argumento de BUSCARV está invertido respecto de Excel
  // desde el evaluador anterior. Se fija aquí para que la diferencia se vea.
  check(
    "C6 sigue en error, por su causa conocida y ajena a este cambio",
    result.values["Resumen!C6"] === "#ERROR",
    String(result.values["Resumen!C6"]),
  );

  check("ninguna celda circular", result.circular.size === 0);

  // Decimales escritos con coma: el motor los deja como texto, así que una
  // fórmula que los use calculará sobre texto. Conviene saber cuántos hay.
  const decimalesConComa = Object.entries(book).filter(
    ([, cell]) =>
      !cell.formula.startsWith("=") && /^-?\d+,\d+$/.test(cell.formula.trim()),
  );
  console.log(
    `  info  ${decimalesConComa.length} celda(s) con decimales escritos con coma: ${decimalesConComa
      .slice(0, 4)
      .map(([ref]) => ref)
      .join(", ")}`,
  );

  // Los errores del motor son exactamente estos tres. Buscar cualquier texto
  // que empiece por `#` marcaría como error a `Resumen!Y29`, cuyo contenido es
  // el rótulo «# refrigeraciones».
  const SENTINELS = ["#ERROR", "#CIRCULAR", "#ARGS"];
  const errores = Object.entries(result.values).filter(([, value]) =>
    SENTINELS.includes(String(value)),
  );
  check(
    "C6 es la única celda en error de toda la plantilla",
    errores.length === 1 && errores[0][0] === "Resumen!C6",
    errores.map(([ref]) => ref).join(", "),
  );

  console.log(
    failures === 0
      ? "\nLa plantilla carga y calcula correctamente."
      : `\n${failures} comprobación(es) fallan.`,
  );

  process.exit(failures === 0 ? 0 : 1);
};

void main();
