import type { CellTrace, TraceNode, TraceRef } from "@rymel/design-template";

interface Props {
  sheetName: string;
  activeRef: string;
  trace: CellTrace;
  full: boolean;
  onToggleFull: (full: boolean) => void;
  onNavigate: (target: TraceRef) => void;
}

const ORIGIN_LABEL: Record<TraceNode["origin"], string> = {
  formula: "fórmula",
  literal: "valor",
  element: "dato del elemento",
  empty: "vacía",
};

/**
 * De qué se alimenta la celda activa y a quién alimenta.
 *
 * En la rejilla se ven los de la hoja activa; aquí se listan todos, incluidos
 * los de otras hojas, y cada uno lleva a su sitio.
 *
 * Es el mismo panel del editor de plantillas del administrador
 * (project-admin, `TracePanel.tsx`): si cambia uno, conviene cambiar el otro.
 */
export const TracePanel = ({
  sheetName,
  activeRef,
  trace,
  full,
  onToggleFull,
  onNavigate,
}: Props) => (
  <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 text-sm">
    <p className="font-mono text-xs text-gray-500">
      {sheetName}!{activeRef}
    </p>

    {trace.circular && (
      <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
        Esta celda forma parte de una referencia circular.
      </p>
    )}

    <Section
      title="Se alimenta de"
      color="bg-emerald-500"
      empty="No lee ninguna celda."
      items={trace.precedents}
      currentSheet={sheetName}
      onNavigate={onNavigate}
    />

    {trace.designCalls.length > 0 && (
      <div>
        <h3 className="text-xs font-medium text-gray-700">Fórmulas de diseño que invoca</h3>
        {trace.designCalls.map((call) => (
          <div key={call.code} className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs">
            <span className="font-mono font-medium">{call.code}</span>
            {call.refs.length > 0 ? (
              <span className="text-gray-600">
                {" "}con {call.refs.map((ref) => ref.ref).join(", ")}
              </span>
            ) : (
              <span className="text-gray-500"> sin celdas en sus argumentos</span>
            )}
          </div>
        ))}
      </div>
    )}

    <Section
      title="La usan"
      color="bg-orange-500"
      empty="Ninguna celda la usa."
      items={trace.dependents}
      currentSheet={sheetName}
      onNavigate={onNavigate}
    />

    <label className="flex items-center gap-2 text-xs text-gray-700">
      <input
        type="checkbox"
        checked={full}
        onChange={(event) => onToggleFull(event.target.checked)}
      />
      Cadena completa de entradas
    </label>

    {full && trace.chain && (
      <div className="space-y-2">
        {trace.chain.length === 0 && (
          <p className="text-xs text-gray-500">No depende de ninguna otra celda.</p>
        )}
        {trace.chain.map((level, index) => (
          <div key={index}>
            <h4 className="text-[11px] uppercase tracking-wide text-gray-400">
              Nivel {index + 1}
            </h4>
            <div className="mt-1 flex flex-wrap gap-1">
              {level.map((node) => (
                <button
                  key={`${node.sheet}!${node.ref}`}
                  onClick={() => onNavigate(node)}
                  title={ORIGIN_LABEL[node.origin]}
                  className={`rounded px-1.5 py-0.5 font-mono text-xs ${
                    node.origin === "element"
                      ? "bg-purple-50 text-purple-800"
                      : node.origin === "literal"
                        ? "bg-gray-100 text-gray-800"
                        : node.origin === "empty"
                          ? "bg-white text-gray-400 ring-1 ring-gray-200"
                          : "bg-emerald-50 text-emerald-800"
                  }`}
                >
                  {node.sheet === sheetName ? node.ref : `${node.sheet}!${node.ref}`}
                  {node.elementKey && ` · ${node.elementKey}`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const Section = ({
  title,
  color,
  empty,
  items,
  currentSheet,
  onNavigate,
}: {
  title: string;
  color: string;
  empty: string;
  items: TraceRef[];
  currentSheet: string;
  onNavigate: (target: TraceRef) => void;
}) => (
  <div>
    <h3 className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {title} ({items.length})
    </h3>
    {items.length === 0 ? (
      <p className="mt-1 text-xs text-gray-500">{empty}</p>
    ) : (
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <button
            key={`${item.sheet}!${item.ref}`}
            onClick={() => onNavigate(item)}
            className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800 hover:bg-blue-100"
          >
            {item.sheet === currentSheet ? item.ref : `${item.sheet}!${item.ref}`}
          </button>
        ))}
      </div>
    )}
  </div>
);
