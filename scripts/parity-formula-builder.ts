/**
 * Paridad entre la construcción de fórmulas que había en `SpreadSheet.tsx` y
 * la que ahora vive en `@rymel/formula-engine`.
 *
 * La copia vieja se reproduce aquí tal cual estaba —incluida su forma de armar
 * el rango— y se enfrenta a la compartida sobre las secuencias que el
 * diseñador produce de verdad: referencia local, a otra hoja, a otra instancia
 * y rango.
 *
 * No es una prueba de regresión: es la evidencia de qué cambia y qué no al
 * dejar de tener dos implementaciones. Lo que cambia se declara abajo.
 *
 *   npx tsx scripts/parity-formula-builder.ts
 */

import {
  buildRangeRef,
  formulaBuilderReducer,
  initialFormulaBuilderState,
  qualifyCellRef,
  type FormulaBuilderState,
} from "@rymel/formula-engine";

interface Escenario {
  nombre: string;
  /** Instancia y hoja de la celda que contiene la fórmula. */
  origen: { instancia: string; hoja: string };
  /** Instancia y hoja apuntadas por el selector. */
  destino: { instancia: string; hoja: string };
  /** Primer extremo del rango, si se está formando uno. */
  rangoDesde?: string;
  /** Celda pulsada. */
  clic: string;
}

/** La implementación que vivía dentro del componente, copiada literalmente. */
const referenciaVieja = (e: Escenario): string => {
  if (e.rangoDesde && e.rangoDesde !== e.clic) {
    return `${e.rangoDesde}:${e.clic}`;
  }

  if (e.destino.instancia !== e.origen.instancia) {
    return `${e.destino.instancia}:${e.destino.hoja}!${e.clic}`;
  }

  if (e.destino.hoja !== e.origen.hoja) {
    return `${e.destino.hoja}!${e.clic}`;
  }

  return e.clic;
};

/** Lo que produce ahora el reducer compartido, con el mismo estado. */
const referenciaNueva = (e: Escenario): string => {
  let state: FormulaBuilderState = formulaBuilderReducer(
    initialFormulaBuilderState(),
    {
      type: "start",
      draft: "=",
      sheet: e.origen.hoja,
      instance: e.origen.instancia,
    },
  );

  state = e.rangoDesde
    ? formulaBuilderReducer(state, {
        type: "toggleRange",
        activeRef: e.rangoDesde,
      })
    : formulaBuilderReducer(state, { type: "togglePicking" });

  state = formulaBuilderReducer(state, {
    type: "pick",
    sheet: e.destino.hoja,
    ref: e.clic,
    instance: e.destino.instancia,
  });

  return state.draft.slice(1); // sin el `=` inicial
};

/** Y lo mismo que hace el componente para reflejarlo en la celda. */
const referenciaComponente = (e: Escenario): string => {
  const target = { sheet: e.destino.hoja, instance: e.destino.instancia };
  const current = { sheet: e.origen.hoja, instance: e.origen.instancia };

  return e.rangoDesde && e.rangoDesde !== e.clic
    ? buildRangeRef(e.rangoDesde, e.clic, target, current)
    : qualifyCellRef(e.clic, target, current);
};

const diseno = { instancia: "design", hoja: "Hoja1" };

const escenarios: Escenario[] = [
  {
    nombre: "celda de la misma hoja",
    origen: diseno,
    destino: diseno,
    clic: "A11",
  },
  {
    nombre: "celda de otra hoja de la misma instancia",
    origen: diseno,
    destino: { instancia: "design", hoja: "Tablas" },
    clic: "C231",
  },
  {
    nombre: "celda de otra instancia",
    origen: diseno,
    destino: { instancia: "cost", hoja: "Hoja1" },
    clic: "B4",
  },
  {
    nombre: "rango dentro de la misma hoja",
    origen: diseno,
    destino: diseno,
    rangoDesde: "B45",
    clic: "C156",
  },
  {
    nombre: "rango con otra hoja seleccionada como destino",
    origen: diseno,
    destino: { instancia: "design", hoja: "Tablas" },
    rangoDesde: "B45",
    clic: "C156",
  },
  {
    nombre: "hoja con espacios en el nombre",
    origen: diseno,
    destino: { instancia: "design", hoja: "Template 1F" },
    clic: "A11",
  },
];

let divergencias = 0;

for (const escenario of escenarios) {
  const vieja = referenciaVieja(escenario);
  const nueva = referenciaNueva(escenario);
  const componente = referenciaComponente(escenario);

  if (nueva !== componente) {
    console.error(
      `✗ ${escenario.nombre}: el reducer y el componente no coinciden — ` +
        `${nueva} vs ${componente}`,
    );
    divergencias += 1;
    continue;
  }

  if (vieja === nueva) {
    console.log(`= ${escenario.nombre}: ${nueva}`);
  } else {
    console.log(`≠ ${escenario.nombre}: antes ${vieja} → ahora ${nueva}`);
    divergencias += 1;
  }
}

console.log(
  `\n${escenarios.length - divergencias}/${escenarios.length} escenarios ` +
    `producen exactamente la misma referencia que antes.`,
);

if (divergencias > 0) {
  console.log(
    "\nLas diferencias son deliberadas y están declaradas en el commit:\n" +
      "  · Los rangos se califican en los dos extremos. La copia vieja armaba\n" +
      "    siempre `B45:C156` sin hoja, así que un rango con otra hoja\n" +
      "    seleccionada como destino apuntaba a celdas de la hoja actual: no\n" +
      "    daba error, daba otro número.\n" +
      "  · Los nombres de hoja con espacios van entre comillas simples, que es\n" +
      "    lo que el analizador necesita para leerlos.",
  );
}
