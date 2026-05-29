import React, { useEffect, useState } from "react";

// Interactive tutorial that walks the user through the BOM workflow using a
// styled mini-spreadsheet + simulated context menus / modals. Not a real
// recording — each step is a self-contained scene animated with CSS, with
// play / pause / prev / next controls similar to a video player.

interface Step {
  title: string;
  description: string;
  render: () => React.ReactNode;
  durationMs?: number;
}

const STEP_DEFAULT_MS = 6000;

const BomTutorial: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // sceneKey forces the scene to re-mount when the step changes so CSS
  // animations restart from frame 0 instead of being skipped.
  const sceneKey = currentStep;

  const steps: Step[] = [
    {
      title: "Resumen BOM en 5 pasos",
      description:
        "Aprende a generar automáticamente la lista de materiales (BOM) a partir de tus zonas semi-terminado, un catálogo etiquetado y condiciones por celda.",
      render: () => <SceneIntro />,
    },
    {
      title: "Paso 1 · Marcar la tabla catálogo (con tags)",
      description:
        "Selecciona el rango con tu catálogo. Clic derecho → \"Marcar como tabla de catálogo\". Define las columnas Item ID / Descripción / U.M. y agrega tags (palabras clave) que describan el catálogo (ej. aluminio, rectangular).",
      render: () => <SceneCatalog />,
    },
    {
      title: "Paso 2 · Asignar zona semi-terminado",
      description:
        "En tu hoja de trabajo, selecciona el área que pertenece a un semi-terminado (ej. Bobina BT). Clic derecho → \"Asignar zona a semi-terminado\".",
      render: () => <SceneZone />,
    },
    {
      title: "Paso 3 · Configurar condiciones de la celda",
      description:
        "Sobre la celda valor (ej. Espesor=3), clic derecho → \"⚙️ Configurar vínculo al catálogo\". Indica qué celdas se usan como condición — sus valores se comparan contra los tags del catálogo para abrir el modal correcto.",
      render: () => <SceneConditions />,
    },
    {
      title: "Paso 4 · Vincular item (modal viewer)",
      description:
        "Clic derecho → \"🔗 Vincular a item del catálogo\". Se abre un modal con la tabla cuyos tags coinciden con tus condiciones — busca, haz clic en la fila y listo.",
      render: () => <SceneLink />,
    },
    {
      title: "Paso 5 · Crear hoja Resumen BOM",
      description:
        "Botón \"📋 Resumen BOM\" en la barra de hojas. Se genera una hoja read-only con todos los semi-terminados y sus materiales agrupados.",
      render: () => <SceneBom />,
    },
    {
      title: "¡Listo!",
      description:
        "Tu BOM se actualiza automáticamente cuando edites valores, links o catálogos. Cualquier vínculo huérfano (catálogo borrado, item inexistente) aparece marcado en rojo.",
      render: () => <SceneDone />,
    },
  ];

  // Auto-advance when playing. Pauses on the last step.
  useEffect(() => {
    if (!isPlaying) return;
    const duration = steps[currentStep].durationMs ?? STEP_DEFAULT_MS;
    const t = setTimeout(() => {
      if (currentStep < steps.length - 1) {
        setCurrentStep((c) => c + 1);
      } else {
        setIsPlaying(false);
      }
    }, duration);
    return () => clearTimeout(t);
  }, [currentStep, isPlaying, steps]);

  const goPrev = () => setCurrentStep((c) => Math.max(0, c - 1));
  const goNext = () =>
    setCurrentStep((c) => Math.min(steps.length - 1, c + 1));
  const togglePlay = () => {
    if (currentStep === steps.length - 1) setCurrentStep(0);
    setIsPlaying((p) => !p);
  };

  const step = steps[currentStep];

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar / step indicator */}
      <div className="flex gap-1 mb-4">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setIsPlaying(false);
              setCurrentStep(i);
            }}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i === currentStep
                ? "bg-cyan-600"
                : i < currentStep
                  ? "bg-cyan-300"
                  : "bg-gray-200 hover:bg-gray-300"
            }`}
            aria-label={`Paso ${i + 1}`}
          />
        ))}
      </div>

      {/* Title + description */}
      <div className="mb-3">
        <h3 className="text-lg font-bold text-gray-800">{step.title}</h3>
        <p className="text-sm text-gray-600 mt-1">{step.description}</p>
      </div>

      {/* Stage */}
      <div
        key={sceneKey}
        className="flex-1 min-h-[320px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 p-4 overflow-hidden relative"
      >
        {step.render()}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-4 px-2">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className="px-3 py-1.5 rounded text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ⏮ Anterior
        </button>
        <button
          onClick={togglePlay}
          className="px-4 py-2 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold shadow"
        >
          {isPlaying
            ? "⏸ Pausar"
            : currentStep === steps.length - 1
              ? "↻ Reiniciar"
              : "▶ Reproducir"}
        </button>
        <button
          onClick={goNext}
          disabled={currentStep === steps.length - 1}
          className="px-3 py-1.5 rounded text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Siguiente ⏭
        </button>
      </div>
      <div className="text-center text-xs text-gray-400 mt-1">
        Paso {currentStep + 1} de {steps.length}
      </div>

      {/* Tutorial animations — scoped to children via inline <style>. Each
          scene uses keyframe names declared here. */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(8, 145, 178, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(8, 145, 178, 0); }
        }
        @keyframes ripple {
          0% { transform: scale(0); opacity: 0.6; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes drawBorder {
          0% { border-color: transparent; }
          100% { border-color: #0891b2; }
        }
        .anim-fade-in { animation: fadeIn 0.5s ease-out both; }
        .anim-fade-up { animation: fadeUp 0.5s ease-out both; }
        .anim-scale-in { animation: scaleIn 0.4s ease-out both; }
        .anim-slide-down { animation: slideDown 0.5s ease-out both; }
        .anim-pulse-glow { animation: pulseGlow 1.6s ease-out infinite; }
      `}</style>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scenes — each one is a self-contained mock of a part of the spreadsheet UI.
// They use absolute positioning + delay-based animations to "play" sequentially.
// ---------------------------------------------------------------------------

const SceneIntro: React.FC = () => (
  <div className="h-full flex items-center justify-center">
    <div className="grid grid-cols-5 gap-2 max-w-3xl">
      {[
        { n: 1, icon: "📚", label: "Catálogo con tags" },
        { n: 2, icon: "🏷️", label: "Asigna zonas" },
        { n: 3, icon: "⚙️", label: "Configura condiciones" },
        { n: 4, icon: "🔗", label: "Vincula items" },
        { n: 5, icon: "📋", label: "Genera BOM" },
      ].map((card, i) => (
        <div
          key={card.n}
          className="anim-fade-up bg-white rounded-lg shadow-sm border border-gray-200 p-2 text-center"
          style={{ animationDelay: `${i * 180}ms` }}
        >
          <div className="text-2xl mb-1">{card.icon}</div>
          <div className="text-[11px] font-semibold text-gray-700 leading-tight">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Small reusable cell for the mini-spreadsheet scenes
const Cell: React.FC<{
  children?: React.ReactNode;
  className?: string;
  highlighted?: boolean;
  style?: React.CSSProperties;
}> = ({ children, className = "", highlighted = false, style }) => (
  <div
    className={`border border-gray-200 px-1.5 py-0.5 text-[10px] ${highlighted ? "bg-yellow-100" : "bg-white"} ${className}`}
    style={style}
  >
    {children}
  </div>
);

// Faux cursor used to indicate where the user would click.
const Cursor: React.FC<{
  top: number;
  left: number;
  delay?: number;
}> = ({ top, left, delay = 0 }) => (
  <div
    className="absolute anim-fade-in"
    style={{
      top,
      left,
      animationDelay: `${delay}ms`,
      pointerEvents: "none",
      zIndex: 30,
    }}
  >
    <svg width="18" height="22" viewBox="0 0 18 22">
      <path
        d="M2 1 L2 17 L6 13 L9 20 L12 19 L9 12 L15 12 Z"
        fill="#1f2937"
        stroke="#ffffff"
        strokeWidth="1"
      />
    </svg>
  </div>
);

const SceneCatalog: React.FC = () => (
  <div className="h-full relative">
    {/* Mini spreadsheet headers */}
    <div className="grid grid-cols-[28px_repeat(4,80px)] text-[10px] font-semibold text-gray-500">
      <div></div>
      <div className="text-center bg-gray-100 border border-gray-200">A</div>
      <div className="text-center bg-gray-100 border border-gray-200">B</div>
      <div className="text-center bg-gray-100 border border-gray-200">C</div>
      <div className="text-center bg-gray-100 border border-gray-200">D</div>
    </div>
    {/* Rows */}
    <div className="grid grid-cols-[28px_repeat(4,80px)] relative">
      {[
        { row: 1, cells: ["Item", "Descripción", "U.M.", "Otros"] },
        { row: 2, cells: ["240", "Fibra de 2 mm", "KLS", "..."] },
        { row: 3, cells: ["4102", "Papel Prespan 0,13", "KLS", "..."] },
        { row: 4, cells: ["23532", "Alambre 4 mm x 3 mm", "KLS", "..."] },
        { row: 5, cells: ["10348", "Alambre Esmalt.", "KLS", "..."] },
      ].map((r) => (
        <React.Fragment key={r.row}>
          <div className="text-center text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200">
            {r.row}
          </div>
          {r.cells.map((v, i) => (
            <Cell key={i} className={r.row === 1 ? "bg-blue-50 font-semibold" : ""}>
              {v}
            </Cell>
          ))}
        </React.Fragment>
      ))}
      {/* Catalog rectangle overlay — animates in */}
      <div
        className="absolute anim-scale-in"
        style={{
          top: 0,
          left: 28,
          width: 80 * 3,
          height: 18 * 5,
          border: "2px solid #0891b2",
          borderRadius: 2,
          animationDelay: "300ms",
          pointerEvents: "none",
        }}
      >
        <div
          className="absolute top-0 left-0 bg-cyan-600 text-white text-[9px] px-1 font-semibold"
          style={{ borderBottomRightRadius: 3 }}
        >
          Catálogo alambres
        </div>
      </div>
    </div>

    {/* Faux context menu */}
    <div
      className="absolute bg-white border border-gray-300 shadow-lg rounded text-[10px] anim-slide-down"
      style={{ top: 70, left: 200, width: 200, animationDelay: "1200ms" }}
    >
      <div className="px-2 py-1 hover:bg-gray-100">Copiar</div>
      <div className="px-2 py-1 hover:bg-gray-100">Pegar</div>
      <div className="border-t my-0.5"></div>
      <div className="px-2 py-1 bg-cyan-50 text-cyan-700 font-semibold">
        📚 Marcar como tabla de catálogo
      </div>
    </div>

    <Cursor top={92} left={350} delay={1500} />

    {/* Modal stub */}
    <div
      className="absolute bg-white border border-gray-300 shadow-xl rounded p-2 anim-fade-up text-[10px]"
      style={{
        bottom: 8,
        right: 8,
        width: 230,
        animationDelay: "2800ms",
      }}
    >
      <div className="font-semibold mb-1">📚 Nueva tabla catálogo</div>
      <div className="text-gray-500 mb-1">Nombre: Catálogo alambres</div>
      <div className="bg-cyan-50 border border-cyan-200 rounded px-1 py-0.5 mb-1">
        <span className="text-gray-500">Tags:</span>{" "}
        <span className="inline-block bg-cyan-200 text-cyan-800 rounded px-1 mr-0.5 font-semibold">
          aluminio
        </span>
        <span className="inline-block bg-cyan-200 text-cyan-800 rounded px-1 font-semibold">
          rectangular
        </span>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded px-1 py-0.5 mb-1">
        Columna Item ID: <strong>A</strong>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded px-1 py-0.5 mb-1">
        Columna Descripción: <strong>B</strong>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded px-1 py-0.5">
        Columna U.M.: <strong>C</strong>
      </div>
    </div>
  </div>
);

const SceneZone: React.FC = () => (
  <div className="h-full relative">
    <div className="grid grid-cols-[28px_repeat(3,110px)] text-[10px] font-semibold text-gray-500">
      <div></div>
      <div className="text-center bg-gray-100 border border-gray-200">A</div>
      <div className="text-center bg-gray-100 border border-gray-200">B</div>
      <div className="text-center bg-gray-100 border border-gray-200">C</div>
    </div>
    <div className="grid grid-cols-[28px_repeat(3,110px)] relative">
      {[
        { row: 1, cells: ["Formaleta", "", ""] },
        { row: 2, cells: ["Espesor (mm)", "3", ""] },
        { row: 3, cells: ["Aislamiento", "2", ""] },
        { row: 4, cells: ["Cuña redondo", "6", ""] },
        { row: 5, cells: ["Densidad", "2,0", ""] },
      ].map((r) => (
        <React.Fragment key={r.row}>
          <div className="text-center text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200">
            {r.row}
          </div>
          {r.cells.map((v, i) => (
            <Cell
              key={i}
              className={
                r.row === 1
                  ? "bg-purple-50 font-semibold text-purple-700"
                  : ""
              }
            >
              {v}
            </Cell>
          ))}
        </React.Fragment>
      ))}
      {/* Zone tint overlay */}
      <div
        className="absolute anim-scale-in"
        style={{
          top: 18, // skip row 1 (the "header")
          left: 28,
          width: 110 * 3,
          height: 18 * 4,
          backgroundColor: "rgba(254, 243, 199, 0.6)",
          border: "1px dashed #f59e0b",
          animationDelay: "300ms",
          pointerEvents: "none",
        }}
      >
        <div
          className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] px-1 font-semibold"
          style={{ borderBottomLeftRadius: 3 }}
        >
          BOBINA
        </div>
      </div>
    </div>

    {/* Faux context menu */}
    <div
      className="absolute bg-white border border-gray-300 shadow-lg rounded text-[10px] anim-slide-down"
      style={{ top: 60, left: 200, width: 210, animationDelay: "1200ms" }}
    >
      <div className="px-2 py-1 hover:bg-gray-100">Combinar celdas</div>
      <div className="border-t my-0.5"></div>
      <div className="px-2 py-1 bg-amber-50 text-amber-700 font-semibold">
        🏷️ Asignar zona a semi-terminado
      </div>
    </div>

    <Cursor top={82} left={360} delay={1500} />

    {/* Modal stub */}
    <div
      className="absolute bg-white border border-gray-300 shadow-xl rounded p-2 anim-fade-up text-[10px]"
      style={{
        bottom: 8,
        right: 8,
        width: 220,
        animationDelay: "2800ms",
      }}
    >
      <div className="font-semibold mb-1">🏷️ Nueva zona semi-terminado</div>
      <div className="bg-amber-50 border border-amber-300 rounded px-1 py-0.5 mb-1">
        Semi-terminado: <strong>Bobina BT (BOBINA)</strong>
      </div>
      <div className="text-gray-500">Rango: A2:C5</div>
    </div>
  </div>
);

const SceneConditions: React.FC = () => (
  <div className="h-full relative">
    {/* Working sheet stub */}
    <div className="absolute top-0 left-0">
      <div className="text-[10px] text-gray-500 font-semibold mb-0.5">
        Hoja: Diseño · Devanado Secundario (Bobina BT)
      </div>
      <div className="grid grid-cols-[130px_60px] gap-0">
        <Cell className="bg-gray-50 font-semibold">Material devanado</Cell>
        <Cell className="bg-red-50 text-red-700 font-semibold">Aluminio</Cell>
        <Cell className="bg-gray-50 font-semibold">Tipo conductor</Cell>
        <Cell className="bg-red-50 text-red-700 font-semibold">Rectangular</Cell>
        <Cell className="bg-purple-50 text-purple-700 font-semibold">
          Espesor (mm)
        </Cell>
        <Cell
          className="anim-pulse-glow"
          style={{ backgroundColor: "rgba(254, 243, 199, 0.6)" }}
        >
          3
        </Cell>
      </div>
    </div>

    {/* Context menu */}
    <div
      className="absolute bg-white border border-gray-300 shadow-lg rounded text-[10px] anim-slide-down"
      style={{ top: 56, left: 200, width: 220, animationDelay: "400ms" }}
    >
      <div className="px-2 py-1 hover:bg-gray-100">🔗 Vincular a item</div>
      <div className="border-t my-0.5"></div>
      <div className="px-2 py-1 bg-cyan-50 text-cyan-700 font-semibold">
        ⚙️ Configurar vínculo al catálogo
      </div>
    </div>

    <Cursor top={68} left={400} delay={700} />

    {/* Condition modal stub */}
    <div
      className="absolute bg-white border border-gray-300 shadow-xl rounded p-2 anim-fade-up text-[10px]"
      style={{
        bottom: 8,
        right: 8,
        width: 280,
        animationDelay: "1800ms",
      }}
    >
      <div className="font-semibold mb-1">
        ⚙️ Configurar vínculo · <span className="font-mono">B7</span>
      </div>
      <div className="text-gray-500 mb-1">
        Celdas de condición (sus valores = tags):
      </div>
      <div className="bg-gray-50 border border-gray-300 rounded px-1.5 py-1 mb-1 font-mono">
        B3, B5
      </div>
      <div className="bg-cyan-50 border border-cyan-200 rounded px-1.5 py-1">
        <div className="text-cyan-700">
          B3 ={" "}
          <span className="font-semibold">"aluminio"</span>
        </div>
        <div className="text-cyan-700">
          B5 ={" "}
          <span className="font-semibold">"rectangular"</span>
        </div>
      </div>
    </div>
  </div>
);

const SceneLink: React.FC = () => (
  <div className="h-full relative">
    {/* Working sheet (background, behind modal) */}
    <div className="absolute top-0 left-0 opacity-40">
      <div className="text-[10px] text-gray-500 font-semibold mb-0.5">
        Hoja: Diseño
      </div>
      <div className="grid grid-cols-[110px_60px] gap-0">
        <Cell className="bg-purple-50 text-purple-700 font-semibold">
          Espesor (mm)
        </Cell>
        <Cell
          className="relative"
          style={{ backgroundColor: "rgba(254, 243, 199, 0.6)" }}
        >
          3
          {/* Badge appears at the end of the scene */}
          <span
            className="absolute bottom-0 right-0 bg-cyan-600 text-white text-[8px] px-0.5 anim-fade-in"
            style={{
              borderTopLeftRadius: 3,
              animationDelay: "3800ms",
            }}
          >
            #23532
          </span>
        </Cell>
      </div>
    </div>

    {/* Modal viewer */}
    <div
      className="absolute bg-white border border-gray-300 shadow-2xl rounded-lg anim-scale-in flex flex-col"
      style={{
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        width: 360,
        animationDelay: "300ms",
        maxHeight: "calc(100% - 16px)",
      }}
    >
      {/* Modal header */}
      <div className="px-2 py-1.5 border-b flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold text-gray-800">
            🔗 Vincular a item del catálogo ·{" "}
            <span className="font-mono text-cyan-700">B7</span>
          </div>
          <div className="text-[9px] text-cyan-600 mt-0.5">
            Filtrado por condiciones · ver todos los catálogos
          </div>
        </div>
        <span className="text-gray-400 text-sm">✕</span>
      </div>

      {/* Search */}
      <div className="px-2 pt-1.5">
        <div className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-[9px] text-gray-400">
          Buscar por ID, descripción o U.M...
        </div>
        <div className="text-[8px] text-gray-500 mt-1 flex items-center gap-1">
          <span>📄 Catálogo</span>
          <span>·</span>
          <span>A1:D6</span>
          <span>·</span>
          <span>
            Tags:
            <span className="inline-block bg-cyan-100 text-cyan-700 rounded px-1 ml-0.5">
              aluminio
            </span>
            <span className="inline-block bg-cyan-100 text-cyan-700 rounded px-1 ml-0.5">
              rectangular
            </span>
          </span>
        </div>
      </div>

      {/* Rows */}
      <div className="px-2 py-1.5 overflow-y-auto">
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="bg-blue-50 text-gray-700">
              <th className="border border-gray-300 px-1 py-0.5 text-left">
                Item ID
              </th>
              <th className="border border-gray-300 px-1 py-0.5 text-left">
                Descripción
              </th>
              <th className="border border-gray-300 px-1 py-0.5 text-left">
                U.M.
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 px-1 py-0.5 font-mono">
                240
              </td>
              <td className="border border-gray-200 px-1 py-0.5">
                Fibra de 2 mm
              </td>
              <td className="border border-gray-200 px-1 py-0.5">KLS</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-1 py-0.5 font-mono">
                4102
              </td>
              <td className="border border-gray-200 px-1 py-0.5">
                Papel Prespan 0,13
              </td>
              <td className="border border-gray-200 px-1 py-0.5">KLS</td>
            </tr>
            <tr className="bg-cyan-100 anim-pulse-glow">
              <td className="border border-gray-200 px-1 py-0.5 font-mono font-semibold">
                23532
              </td>
              <td className="border border-gray-200 px-1 py-0.5 font-semibold">
                Alambre 4 mm x 3 mm
              </td>
              <td className="border border-gray-200 px-1 py-0.5 font-semibold">
                KLS
              </td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-1 py-0.5 font-mono">
                10348
              </td>
              <td className="border border-gray-200 px-1 py-0.5">
                Alambre Esmalt.
              </td>
              <td className="border border-gray-200 px-1 py-0.5">KLS</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Cursor top={148} left={250} delay={2800} />
  </div>
);

const SceneBom: React.FC = () => (
  <div className="h-full relative flex flex-col">
    {/* Sheet tabs mockup */}
    <div className="flex items-center gap-1 mb-3 anim-fade-in">
      <div className="px-2 py-1 bg-white border-t-2 border-blue-500 rounded-t text-[10px] font-medium">
        Diseño
      </div>
      <div className="px-2 py-1 bg-gray-200 rounded-t text-[10px] font-medium">
        Catálogo
      </div>
      <div className="px-2 py-1 text-[10px] font-medium text-gray-500">
        + Agregar Hoja
      </div>
      <div
        className="px-2 py-1 text-[10px] font-semibold bg-cyan-600 text-white rounded anim-pulse-glow"
        style={{ animationDelay: "300ms" }}
      >
        📋 Resumen BOM
      </div>
    </div>

    <Cursor top={2} left={236} delay={600} />

    {/* BOM mock — appears mid-step */}
    <div
      className="flex-1 bg-white rounded-lg border border-gray-200 p-3 overflow-hidden anim-scale-in"
      style={{ animationDelay: "1800ms" }}
    >
      <div className="text-[11px] font-bold text-gray-800 mb-2">
        Resumen de materiales (BOM)
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-bold text-gray-900 text-[10px]">500752</span>
        <span className="text-purple-700 font-semibold text-[10px]">
          Semielaborado : Bobina BT
        </span>
        <span className="text-gray-400 text-[9px]">[BOBINA]</span>
      </div>
      <table className="border-collapse text-[10px] ml-12">
        <thead>
          <tr className="bg-blue-100">
            <th className="border border-gray-300 px-1.5 py-0.5">Item</th>
            <th className="border border-gray-300 px-1.5 py-0.5">
              Descripción
            </th>
            <th className="border border-gray-300 px-1.5 py-0.5">Cantidad</th>
            <th className="border border-gray-300 px-1.5 py-0.5">U.M.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-300 px-1.5 py-0.5 font-mono">
              240
            </td>
            <td className="border border-gray-300 px-1.5 py-0.5">
              Fibra de 2 mm
            </td>
            <td className="border border-gray-300 px-1.5 py-0.5 text-right">
              0,075
            </td>
            <td className="border border-gray-300 px-1.5 py-0.5">KLS</td>
          </tr>
          <tr>
            <td className="border border-gray-300 px-1.5 py-0.5 font-mono">
              23532
            </td>
            <td className="border border-gray-300 px-1.5 py-0.5">
              Alambre rect. aluminio 4 mm x 3 mm
            </td>
            <td className="border border-gray-300 px-1.5 py-0.5 text-right">
              3
            </td>
            <td className="border border-gray-300 px-1.5 py-0.5">KLS</td>
          </tr>
          <tr>
            <td className="border border-gray-300 px-1.5 py-0.5 font-mono">
              10348
            </td>
            <td className="border border-gray-300 px-1.5 py-0.5">
              Alambre Esmalt. AWG-8 Alum.
            </td>
            <td className="border border-gray-300 px-1.5 py-0.5 text-right">
              25,97
            </td>
            <td className="border border-gray-300 px-1.5 py-0.5">KLS</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

const SceneDone: React.FC = () => (
  <div className="h-full flex flex-col items-center justify-center text-center">
    <div className="text-5xl mb-3 anim-fade-up">🎉</div>
    <div className="text-xl font-bold text-gray-800 mb-2 anim-fade-up" style={{ animationDelay: "150ms" }}>
      ¡Listo!
    </div>
    <div
      className="space-y-1 text-sm text-gray-600 anim-fade-up"
      style={{ animationDelay: "300ms" }}
    >
      <div>✓ Catálogo de items definido</div>
      <div>✓ Zonas semi-terminado asignadas</div>
      <div>✓ Celdas vinculadas al catálogo</div>
      <div>✓ Hoja Resumen BOM autogenerada</div>
    </div>
    <div
      className="mt-4 text-xs text-gray-400 italic max-w-md anim-fade-up"
      style={{ animationDelay: "500ms" }}
    >
      El BOM se actualiza solo al editar cualquier valor, link o catálogo. Los
      vínculos huérfanos (catálogo borrado, item inexistente) se marcan en
      rojo para que los corrijas.
    </div>
  </div>
);

export default BomTutorial;
