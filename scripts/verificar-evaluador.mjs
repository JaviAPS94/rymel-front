/**
 * Verificación del evaluador nuevo de project-front contra los datos reales.
 *
 * Ejercita **el mismo módulo que usa la interfaz** (`formula-evaluation.ts`),
 * no una réplica: por eso la lógica se extrajo del componente. Resuelve las
 * funciones personalizadas contra project-back de verdad, igual que el
 * navegador.
 *
 * Contrasta el resultado contra el `computed` almacenado de cada sub-diseño y
 * cuenta cuántas peticiones hizo, para comprobar que los lotes funcionan.
 *
 *   node scripts/verificar-evaluador.mjs <token-jwt> [url-api]
 */

const TOKEN = process.argv[2];
const API = process.argv[3] ?? "http://localhost:3000";

if (!TOKEN) {
  console.error("Falta el token JWT como primer argumento.");
  process.exit(1);
}

// El módulo se transpila antes con esbuild; es el mismo código que importa
// el componente, no una réplica:
//   node_modules/esbuild/bin/esbuild src/components/design/formula-evaluation.ts \
//     --format=esm --platform=node --outfile=/tmp/fe/formula-evaluation.mjs
const { evaluateFormulaWith, recalculateCells } = await import(
  process.env.MODULO ?? "/tmp/fe/formula-evaluation.mjs"
);

const api = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return response.json();
};

/** Celdas de un sub-diseño, en cualquiera de las formas que hay guardadas. */
const cellsOf = (data) => {
  if (!data || typeof data !== "object") return null;
  if (data.cells && typeof data.cells === "object") return data.cells;
  const looksLikeCells = Object.values(data).some(
    (value) =>
      value && typeof value === "object" && ("formula" in value || "computed" in value),
  );
  return looksLikeCells ? data : null;
};

let requestCount = 0;
let invocationCount = 0;

const makeResolver = () => async (calls) => {
  if (calls.length === 0) return [];
  requestCount += 1;
  invocationCount += calls.length;

  const data = await api("/design-functions/calculate", {
    method: "POST",
    body: JSON.stringify({
      functions: calls.map((call) => ({
        designFunctionId: Number(call.definition.id),
        parameters: call.parameters,
      })),
    }),
  });

  return calls.map((_, index) => {
    const result = data.results[index];
    return result === undefined
      ? { error: "sin resultado" }
      : { value: Number(result.result) };
  });
};

const equivalent = (a, b) => {
  if (Object.is(a, b)) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= Math.max(1e-9, Math.abs(a) * 1e-12);
  }
  return false;
};

const subDesignIds = process.env.SUB_DESIGNS
  ? process.env.SUB_DESIGNS.split(",").map(Number)
  : null;

// `by-filters-paginated` devuelve vacío sin filtros, así que se recorren los
// diseños por identificador. Son pocos y el rango cubre todos los existentes.
const MAX_DESIGN_ID = Number(process.env.MAX_DESIGN_ID ?? 60);

let compared = 0;
let matching = 0;
let skippedNoSubType = 0;
const divergences = [];
let bulkCompared = 0;
let bulkMatching = 0;
const bulkDivergences = [];
const bulkStats = [];

for (let designId = 1; designId <= MAX_DESIGN_ID; designId++) {
  const detail = await api(`/design/by-id/${designId}`).catch(() => null);
  if (!detail) continue;

  const subTypeId = detail.designSubType?.id ?? detail.designSubtypeId;
  if (subTypeId === undefined) skippedNoSubType += 1;
  if (subTypeId === undefined) continue;

  const subType = await api(`/design/subtypes/${subTypeId}/with-functions`).catch(
    () => null,
  );
  if (!subType) continue;

  const customFunctions = (subType.designFunctions ?? []).map((func) => ({
    id: func.id,
    code: func.code,
    variables: func.variables.split(",").map((v) => v.trim()).filter(Boolean),
  }));

  for (const subDesign of detail.subDesigns ?? []) {
    if (subDesignIds && !subDesignIds.includes(subDesign.id)) continue;

    const data =
      typeof subDesign.data === "string"
        ? JSON.parse(subDesign.data)
        : subDesign.data;
    const cells = cellsOf(data);
    if (!cells) continue;

    const localCellValue = (ref) => cells[ref]?.computed;

    // --- Ruta de recálculo completa: es la que agrupa por nivel ---
    const formulaRefs = Object.entries(cells)
      .filter(([, cell]) => typeof cell?.formula === "string" && cell.formula.startsWith("="))
      .map(([ref]) => ref);

    if (formulaRefs.length > 0) {
      const before = requestCount;
      const bulk = await recalculateCells(
        Object.fromEntries(
          Object.entries(cells).map(([ref, cell]) => [ref, { formula: cell?.formula }]),
        ),
        formulaRefs,
        {
          customFunctions,
          resolveCustomFunctions: makeResolver(),
          crossSheetCellValue: () => 0,
        },
      );
      bulkStats.push({
        subDesign: subDesign.id,
        celdas: formulaRefs.length,
        peticiones: requestCount - before,
      });
      for (const ref of formulaRefs) {
        bulkCompared += 1;
        if (equivalent(cells[ref].computed, bulk.values[ref])) bulkMatching += 1;
        else
          bulkDivergences.push({
            subDesign: subDesign.id,
            ref,
            formula: cells[ref].formula,
            stored: cells[ref].computed,
            got: bulk.values[ref],
          });
      }
    }

    for (const [ref, cell] of Object.entries(cells)) {
      const formula = cell?.formula;
      if (typeof formula !== "string" || !formula.startsWith("=")) continue;

      const got = await evaluateFormulaWith(formula, {
        customFunctions,
        resolveCustomFunctions: makeResolver(),
        localCellValue,
        crossSheetCellValue: () => 0,
      });

      compared += 1;
      if (equivalent(cell.computed, got)) matching += 1;
      else
        divergences.push({
          subDesign: subDesign.id,
          ref,
          formula,
          stored: cell.computed,
          got,
        });
    }
  }
}

console.log(
  `celdas evaluadas: ${compared} | coinciden: ${matching} | divergen: ${divergences.length}`,
);
console.log(`diseños sin subtipo (omitidos): ${skippedNoSubType}`);
console.log("");
console.log("--- ruta de recálculo completa (la que agrupa por nivel) ---");
console.log(
  `celdas evaluadas: ${bulkCompared} | coinciden: ${bulkMatching} | divergen: ${bulkDivergences.length}`,
);
const conFormulas = bulkStats.filter((s) => s.celdas > 0);
const totalCeldas = conFormulas.reduce((n, s) => n + s.celdas, 0);
const totalPeticiones = conFormulas.reduce((n, s) => n + s.peticiones, 0);
console.log(
  `peticiones: ${totalPeticiones} para ${totalCeldas} celdas con fórmula en ${conFormulas.length} hojas`,
);
const ejemplo = conFormulas.find((s) => s.celdas >= 4);
if (ejemplo)
  console.log(
    `   ejemplo: sub-diseño ${ejemplo.subDesign} evaluó ${ejemplo.celdas} celdas con ${ejemplo.peticiones} petición(es)`,
  );
if (bulkDivergences.length > 0) {
  console.log("divergencias de la ruta completa:");
  for (const d of bulkDivergences.slice(0, 10))
    console.log(
      `   sub-diseño ${d.subDesign} ${d.ref} ${d.formula}: ${JSON.stringify(d.stored)} -> ${JSON.stringify(d.got)}`,
    );
}

if (divergences.length > 0) {
  console.log("\ndivergencias:");
  for (const divergence of divergences.slice(0, 20)) {
    console.log(
      `   sub-diseño ${divergence.subDesign} ${divergence.ref} ${divergence.formula}: ` +
        `${JSON.stringify(divergence.stored)} -> ${JSON.stringify(divergence.got)}`,
    );
  }
}

process.exit(divergences.length + bulkDivergences.length === 0 ? 0 : 1);
