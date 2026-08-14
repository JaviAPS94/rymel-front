/**
 * Evaluación de fórmulas del diseñador, sobre el motor compartido.
 *
 * Vive fuera del componente a propósito. La lógica anterior estaba enterrada
 * en mil líneas de `SpreadSheet.tsx` y no se podía ejercitar sin montar React,
 * así que la única forma de comprobar un cambio era abrir el navegador y
 * mirar. Aquí es una función con sus dependencias inyectadas, y una prueba
 * puede usar exactamente el mismo código que usa la interfaz.
 */

import {
  buildRegistry,
  evaluateCell,
  evaluateSheet,
  extractPrecedents,
  type CellValueMap,
  type CustomFunctionCall,
  type CustomFunctionDefinition,
  type CustomFunctionResult,
  type FormulaValue,
} from "@rymel/formula-engine";

/**
 * Vueltas máximas para resolver funciones personalizadas anidadas. Cada vuelta
 * resuelve un nivel; más que esto significa que algo no converge.
 */
export const MAX_CUSTOM_FUNCTION_ROUNDS = 8;

/** Lo mínimo que la evaluación necesita de una celda. */
export interface EvaluableCell {
  computed?: FormulaValue | undefined;
}

export interface EvaluateFormulaDeps {
  /** Fórmulas de diseño disponibles, con sus variables en orden. */
  customFunctions: readonly CustomFunctionDefinition[];
  /** Resuelve un lote completo de invocaciones en una sola petición. */
  resolveCustomFunctions: (
    calls: CustomFunctionCall[],
  ) => Promise<CustomFunctionResult[]>;
  /** Valor de una celda de la hoja actual. */
  localCellValue: (ref: string) => FormulaValue | undefined;
  /** Valor de una celda de otra hoja o de otra instancia. */
  crossSheetCellValue: (ref: string) => FormulaValue;
}

/**
 * Evalúa una celda.
 *
 * Devuelve `""` para una celda vacía, el número o el texto para un literal, y
 * el resultado de la fórmula cuando empieza por `=`.
 */
export const evaluateFormulaWith = async (
  formula: string,
  deps: EvaluateFormulaDeps,
): Promise<FormulaValue> => {
  if (!formula || formula.trim() === "") return "";

  if (!formula.startsWith("=")) {
    const num = Number.parseFloat(formula);
    return isNaN(num) ? formula : num;
  }

  // Solo los valores que la fórmula referencia, no la hoja entera.
  const cellValues: CellValueMap = {};
  for (const ref of extractPrecedents(formula)) {
    if (ref.includes("!")) {
      cellValues[ref] = deps.crossSheetCellValue(ref);
      continue;
    }
    const computed = deps.localCellValue(ref);
    cellValues[ref] = computed === undefined || computed === "" ? 0 : computed;
  }

  const registry = buildRegistry(deps.customFunctions);
  const resolved = new Map<number, CustomFunctionResult>();

  // Cada vuelta resuelve un nivel de anidamiento: `=CUBIC(QUADRATIC(A1), B1)`
  // necesita el resultado de la interna antes de poder pedir la externa.
  for (let round = 0; round <= MAX_CUSTOM_FUNCTION_ROUNDS; round++) {
    const evaluation = evaluateCell(formula, cellValues, {
      customFunctions: registry,
      customResults: resolved,
    });

    if (evaluation.status === "ok") return evaluation.value;

    const results = await deps.resolveCustomFunctions(
      evaluation.calls.map((pending) => pending.call),
    );

    evaluation.calls.forEach((pending, index) => {
      resolved.set(
        pending.occurrence,
        results[index] ?? { error: "sin resultado para la invocación" },
      );
    });
  }

  // Más vueltas que niveles de anidamiento razonables: algo no converge.
  return "#ERROR";
};

/** Celdas de una hoja, tal como las guarda el diseñador. */
export type EvaluableCells = Record<string, { formula?: string } | undefined>;

export interface RecalculateResult {
  /** Valor calculado de cada celda evaluada. */
  values: Record<string, FormulaValue>;
  /** Celdas que forman parte de una referencia circular. */
  circular: Set<string>;
  /** Peticiones que hizo al puerto: una por nivel de dependencia. */
  batchCount: number;
}

/**
 * Recalcula un conjunto de celdas y sus dependientes, **agrupando** las
 * invocaciones de fórmulas de diseño por nivel de dependencia.
 *
 * Antes esto era un bucle que llamaba a la evaluación celda por celda, y cada
 * celda con una fórmula de diseño hacía su propia petición: una hoja con
 * cuarenta `=QUADRATIC(...)` independientes hacía cuarenta viajes al servidor,
 * aunque el endpoint siempre aceptó un arreglo. Ahora es una petición por
 * nivel del grafo.
 */
export const recalculateCells = async (
  cells: EvaluableCells,
  dirtyCells: readonly string[],
  deps: Omit<EvaluateFormulaDeps, "localCellValue">,
): Promise<RecalculateResult> => {
  // Las referencias a otras hojas se resuelven fuera del motor, que solo
  // conoce las celdas que se le pasan.
  const initialValues: CellValueMap = {};
  for (const cell of Object.values(cells)) {
    const formula = cell?.formula;
    if (typeof formula !== "string" || !formula.startsWith("=")) continue;
    for (const ref of extractPrecedents(formula)) {
      if (ref.includes("!")) initialValues[ref] = deps.crossSheetCellValue(ref);
    }
  }

  const result = await evaluateSheet(cells, {
    customFunctions: deps.customFunctions,
    resolveCustomFunctions: deps.resolveCustomFunctions,
    dirtyCells: [...dirtyCells],
    initialValues,
  });

  const values: Record<string, FormulaValue> = {};
  for (const [ref, value] of Object.entries(result.values)) {
    if (value !== undefined) values[ref] = value;
  }

  return { values, circular: result.circular, batchCount: result.batchCount };
};
