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

  // La configuración del BOM —catálogo, zonas, condiciones y vínculos— es de
  // la plantilla y se administra en project-admin. Aquí solo se enseña lo que
  // el diseñador hace: usarla y generar el resumen.
  const steps: Step[] = [
    {
      title: "Resumen BOM",
      description:
        "La lista de materiales (BOM) se genera sola a partir de lo que trae la plantilla y de los valores de tu diseño.",
      render: () => <SceneIntro />,
    },
    {
      title: "La configuración viene de la plantilla",
      description:
        "Las tablas de catálogo, las zonas de semi-terminado, las condiciones y los ítems vinculados los define el administrador en la plantilla, desde project-admin. En tu hoja los ves marcados, pero no se cambian aquí: si algo no corresponde, pide que se corrija la plantilla.",
      render: () => <SceneSource />,
    },
    {
      title: "Crear hoja Resumen BOM",
      description:
        "Botón \"📋 Resumen BOM\" en la barra de hojas. Se genera una hoja de solo lectura con todos los semi-terminados y sus materiales agrupados.",
      render: () => <SceneBom />,
    },
    {
      title: "¡Listo!",
      description:
        "El resumen se actualiza cuando cambian los valores de tu diseño. Un vínculo huérfano (catálogo borrado, ítem inexistente) aparece marcado en rojo: avisa para que se corrija la plantilla.",
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
    <div className="grid grid-cols-4 gap-2 max-w-3xl">
      {[
        { n: 1, icon: "📚", label: "La plantilla trae el catálogo" },
        { n: 2, icon: "🏷️", label: "y las zonas y vínculos" },
        { n: 3, icon: "✏️", label: "Tú llenas el diseño" },
        { n: 4, icon: "📋", label: "Genera el BOM" },
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

const SceneSource: React.FC = () => (
  <div className="h-full flex items-center justify-center">
    <div className="grid grid-cols-2 gap-4 max-w-2xl text-left">
      <div
        className="anim-fade-up bg-white rounded-lg border border-gray-200 p-3"
        style={{ animationDelay: "0ms" }}
      >
        <div className="text-[11px] font-bold text-gray-800 mb-1">
          project-admin · Plantillas
        </div>
        <ul className="text-[10px] text-gray-600 space-y-0.5">
          <li>📚 Tablas de catálogo con sus tags</li>
          <li>🏷️ Zonas de semi-terminado</li>
          <li>⚙️ Condiciones de cada celda</li>
          <li>🔗 Ítem vinculado</li>
        </ul>
      </div>
      <div
        className="anim-fade-up bg-white rounded-lg border border-gray-200 p-3"
        style={{ animationDelay: "400ms" }}
      >
        <div className="text-[11px] font-bold text-gray-800 mb-1">Tu diseño</div>
        <ul className="text-[10px] text-gray-600 space-y-0.5">
          <li>✏️ Los valores de cálculo</li>
          <li>👁️ Las marcas de la plantilla, visibles</li>
          <li>📋 El resumen BOM generado</li>
        </ul>
      </div>
    </div>
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
      <div>✓ Configuración tomada de la plantilla</div>
      <div>✓ Valores de tu diseño</div>
      <div>✓ Hoja Resumen BOM autogenerada</div>
    </div>
    <div
      className="mt-4 text-xs text-gray-400 italic max-w-md anim-fade-up"
      style={{ animationDelay: "500ms" }}
    >
      El BOM se actualiza solo al cambiar los valores del diseño. Los vínculos
      huérfanos (catálogo borrado, ítem inexistente) se marcan en rojo: se
      corrigen en la plantilla.
    </div>
  </div>
);

export default BomTutorial;
