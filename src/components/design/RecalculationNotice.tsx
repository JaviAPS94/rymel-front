import { useState } from "react";
import { useGetRecalculationNoticeQuery } from "../../store";

interface RecalculationNoticeProps {
  /** Sub-diseño abierto. Sin él no hay nada de lo que avisar. */
  subDesignId?: number;
}

/**
 * Clave de descarte.
 *
 * Va por recálculo y no por diseño: descartar el aviso de un cambio no debe
 * silenciar el del siguiente. El identificador del recálculo cambia con cada
 * uno, así que un recálculo posterior vuelve a avisar aunque el anterior se
 * hubiera descartado.
 */
const dismissKey = (recalculationId: number): string =>
  `recalculo-descartado:${recalculationId}`;

const isDismissed = (recalculationId: number): boolean => {
  try {
    return localStorage.getItem(dismissKey(recalculationId)) === "1";
  } catch {
    return false;
  }
};

const dismiss = (recalculationId: number): void => {
  try {
    localStorage.setItem(dismissKey(recalculationId), "1");
  } catch {
    // Sin almacenamiento el aviso reaparecerá; es preferible a romper la vista.
  }
};

const formatValue = (value: unknown): string =>
  typeof value === "number" ? String(value) : JSON.stringify(value);

/**
 * Aviso de que los valores de esta hoja no son los que el usuario dejó.
 *
 * Distingue dos situaciones que no son lo mismo:
 *
 * - **Recalculada**: alguien publicó una versión nueva de una fórmula y se
 *   recalculó. Los números cambiaron y aquí están los anteriores.
 * - **Desactualizada**: hay una versión nueva, pero **nadie ha tocado los
 *   números**. Siguen siendo los guardados.
 *
 * Confundirlas sería lo peor: alguien podría creer que sus valores cambiaron
 * cuando no lo hicieron, o al revés.
 *
 * Y **pueden darse a la vez**: una hoja recalculada la semana pasada puede
 * volver a quedar desactualizada hoy. En ese caso manda el estado actual —
 * está desactualizada— pero se sigue ofreciendo el detalle de lo que cambió
 * en el último recálculo, porque el usuario quizá no llegó a verlo.
 */
export const RecalculationNotice = ({
  subDesignId,
}: RecalculationNoticeProps) => {
  const { data } = useGetRecalculationNoticeQuery(subDesignId as number, {
    skip: subDesignId === undefined,
  });

  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (!data || hidden) return null;

  const hasRecalculation =
    data.recalculationId !== undefined && data.changedCells.length > 0;
  const recalculationSeen =
    hasRecalculation && isDismissed(data.recalculationId as number);

  // El detalle del recálculo se ofrece mientras no se haya descartado.
  const showChanges = hasRecalculation && !recalculationSeen;

  // Ni desactualizada ni con un recálculo por ver: no hay nada que decir.
  if (!data.isStale && !showChanges) return null;

  // El estado actual manda sobre el suceso pasado.
  const wasRecalculated = showChanges && !data.isStale;

  const functionNames = data.functions
    .map((func) => `${func.name} (v${func.version})`)
    .join(", ");

  return (
    <div
      className={`mb-3 rounded-lg border p-4 ${
        wasRecalculated
          ? "border-amber-300 bg-amber-50"
          : "border-blue-200 bg-blue-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {wasRecalculated ? (
            <>
              <p className="font-semibold text-amber-900">
                Algunos valores de esta hoja se actualizaron
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Cambiaron {data.changedCells.length} celda(s) porque se publicó
                una versión nueva de{" "}
                {functionNames || "las fórmulas que usa esta hoja"}.
                {data.recalculatedAt &&
                  ` El recálculo fue el ${new Date(
                    data.recalculatedAt,
                  ).toLocaleString("es")}.`}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-blue-900">
                Esta hoja se calculó con una versión anterior de las fórmulas
              </p>
              <p className="mt-1 text-sm text-blue-800">
                Sus valores siguen siendo los guardados: nadie los ha
                modificado. Un administrador puede recalcularla cuando
                corresponda.
                {showChanges &&
                  ` En un recálculo anterior cambiaron ${data.changedCells.length} celda(s).`}
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {showChanges && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="rounded border border-amber-400 px-3 py-1 text-sm text-amber-900 hover:bg-amber-100"
            >
              {expanded ? "Ocultar" : "Ver qué cambió"}
            </button>
          )}
          {showChanges && (
            <button
              type="button"
              onClick={() => {
                dismiss(data.recalculationId as number);
                // Si además está desactualizada, el aviso azul sigue en pie:
                // descartar "ya vi lo que cambió" no borra el estado actual.
                if (!data.isStale) setHidden(true);
                else setExpanded(false);
              }}
              className="rounded px-3 py-1 text-sm text-amber-900 hover:bg-amber-100"
            >
              Entendido
            </button>
          )}
        </div>
      </div>

      {expanded && showChanges && (
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-amber-900">
            <tr>
              <th className="py-1 pr-4">Celda</th>
              <th className="py-1 pr-4">Fórmula</th>
              <th className="py-1 pr-4">Antes</th>
              <th className="py-1">Ahora</th>
            </tr>
          </thead>
          <tbody className="font-mono text-amber-950">
            {data.changedCells.map((cell) => (
              <tr key={cell.ref} className="border-t border-amber-200">
                <td className="py-1 pr-4">{cell.ref}</td>
                <td className="py-1 pr-4">{cell.formula}</td>
                <td className="py-1 pr-4 text-amber-700">
                  {formatValue(cell.before)}
                </td>
                <td className="py-1 font-semibold">{formatValue(cell.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default RecalculationNotice;
