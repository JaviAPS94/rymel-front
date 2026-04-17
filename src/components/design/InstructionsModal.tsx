import React, { useState } from "react";
import { Modal } from "../core/Modal";
import { FaKeyboard, FaCalculator, FaLightbulb } from "react-icons/fa";
import { MdFunctions, MdOutlineImage } from "react-icons/md";
import { BiMath } from "react-icons/bi";
import {
  TbTableOptions,
  TbMathFunction,
  TbLogicAnd,
  TbArrowBigRightLines,
  TbFileCode,
} from "react-icons/tb";

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface InstructionSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  items: {
    label: string;
    description: string;
    example?: string;
  }[];
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeSection, setActiveSection] = useState<string>("navigation");

  const sections: InstructionSection[] = [
    {
      id: "navigation",
      title: "Navegación",
      icon: <FaKeyboard className="w-6 h-6" />,
      color: "blue",
      items: [
        {
          label: "Teclas de Flecha",
          description: "Muévete entre celdas usando ↑ ↓ ← →",
          example: "Presiona ↓ para ir a la celda inferior",
        },
        {
          label: "Enter",
          description: "Confirma el valor y baja a la siguiente celda",
          example: "Escribe un valor y presiona Enter",
        },
        {
          label: "Tab",
          description: "Confirma el valor y mueve a la derecha",
          example: "Útil para llenar filas rápidamente",
        },
        {
          label: "Escape",
          description: "Cancela la edición actual",
          example: "Presiona Esc para descartar cambios",
        },
      ],
    },
    {
      id: "crossref",
      title: "Referencias Cruzadas",
      icon: <TbTableOptions className="w-6 h-6" />,
      color: "green",
      items: [
        {
          label: "Misma Hoja",
          description: "Referencia directa a una celda",
          example: "=A1+B2",
        },
        {
          label: "Otra Hoja",
          description: "Usa el nombre de la hoja seguido de !",
          example: "=SubDiseño2!A1",
        },
        {
          label: "Otra Pestaña",
          description: "Usa el ID de pestaña con : y nombre de hoja",
          example: "=design:Sheet1!A1 o =cost:Hoja1!B5",
        },
        {
          label: "Selector Visual",
          description:
            'Usa el botón "Agregar celda" para seleccionar con clicks',
          example: "Más fácil que escribir manualmente",
        },
      ],
    },
    {
      id: "graphics",
      title: "Gráficos Técnicos",
      icon: <MdOutlineImage className="w-6 h-6" />,
      color: "indigo",
      items: [
        {
          label: "DRAW:FRONTAL:NUCLEO",
          description:
            "Vista frontal del núcleo con coordenadas. Usa referencias de celdas para alto y ancho.",
          example: "DRAW:FRONTAL:NUCLEO:H53,H54",
        },
        {
          label: "DRAW:SUPERIOR:NUCLEO,BOBINA",
          description:
            "Vista superior del núcleo y bobina. Ancho del núcleo y profundidad de bobina.",
          example: "DRAW:SUPERIOR:NUCLEO,BOBINA:,H54:S55",
        },
        {
          label: "DRAW:FRONTAL:TANQUE,NUCLEO,BOBINA",
          description:
            "Vista frontal completa de todos los componentes. Incluye tanque, núcleo y bobina.",
          example: "DRAW:FRONTAL:TANQUE,NUCLEO,BOBINA:H53,H54::AD53,AD55",
        },
        {
          label: "DRAW:SUPERIOR:TANQUE,NUCLEO,BOBINA",
          description:
            "Vista superior completa. Muestra el tanque (círculo), núcleo (rectángulo) y bobina (semicírculos).",
          example: "DRAW:SUPERIOR:TANQUE,NUCLEO,BOBINA:,H54:S55:,AD55",
        },
        {
          label: "Referencias de Dimensiones",
          description:
            "Formato: DRAW:VISTA:COMPONENTES:nucleoAlto,nucleoAncho:bobinaProfundidad:tanqueAlto,tanqueDiametro",
          example:
            "Usa comas para separar dimensiones del mismo componente y : para separar componentes",
        },
        {
          label: "Plano de Coordenadas",
          description:
            "Todos los gráficos incluyen ejes X e Y con medidas cada 50mm. Escala: 1 = 100mm.",
          example: "Las medidas se muestran automáticamente en los ejes",
        },
        {
          label: "Celdas Combinadas",
          description:
            "Los gráficos se ajustan al tamaño de las celdas combinadas. Usa al menos 6x6 celdas combinadas.",
          example: "Combina celdas B44:G49 para crear el área del gráfico",
        },
      ],
    },
    {
      id: "custom",
      title: "Funciones Personalizadas",
      icon: <MdFunctions className="w-6 h-6" />,
      color: "purple",
      items: [
        {
          label: "QUADRATIC(x,a,b,c)",
          description: "Ecuación cuadrática: ax² + bx + c",
          example: "=QUADRATIC(A1,1,2,3)",
        },
        {
          label: "LINEAR(x,m,b)",
          description: "Ecuación lineal: mx + b",
          example: "=LINEAR(A1,2,5)",
        },
        {
          label: "EXPONENTIAL(x,a,b)",
          description: "Función exponencial: a * e^(bx)",
          example: "=EXPONENTIAL(A1,10,0.5)",
        },
        {
          label: "LOGARITHMIC(x,a,b)",
          description: "Función logarítmica: a * ln(x) + b",
          example: "=LOGARITHMIC(A1,5,2)",
        },
        {
          label: "POWER(x,a,b)",
          description: "Función potencia: a * x^b",
          example: "=POWER(A1,2,3)",
        },
      ],
    },
    {
      id: "basic",
      title: "Funciones Básicas",
      icon: <FaCalculator className="w-6 h-6" />,
      color: "orange",
      items: [
        {
          label: "SUM(rango)",
          description: "Suma de valores en un rango",
          example: "=SUM(A1:A10)",
        },
        {
          label: "AVERAGE(rango)",
          description: "Promedio de valores en un rango",
          example: "=AVERAGE(B1:B5)",
        },
        {
          label: "BUSCARV(valor, tabla, columna, exacto)",
          description:
            "Busca un valor en la primera columna de una tabla y devuelve un valor de la columna especificada",
          example: "=BUSCARV(A1, B1:E10, 3, TRUE)",
        },
        {
          label: "VLOOKUP(value, table, column, exact)",
          description:
            "Searches for a value in the first column of a table and returns a value from the specified column",
          example: "=VLOOKUP(A1, B1:E10, 3, TRUE)",
        },
        {
          label: "COINCIDIR(valor, rango/array, tipo)",
          description:
            "Busca un valor en un rango o array y devuelve su posición. Tipo: 0=exacto, 1=menor/igual, -1=mayor/igual",
          example: "=COINCIDIR($C$21, {1;2;4;9;13;20}, 0)",
        },
        {
          label: "ELEGIR(índice, valor1, valor2, ...)",
          description:
            "Devuelve un valor de una lista según el índice especificado (basado en 1)",
          example: "=ELEGIR(2, $A1, $B1, $C1)",
        },
        {
          label: "MIN(rango)",
          description: "Valor mínimo en un rango",
          example: "=MIN(C1:C10)",
        },
        {
          label: "MAX(rango)",
          description: "Valor máximo en un rango",
          example: "=MAX(D1:D10)",
        },
        {
          label: "COUNT(rango)",
          description: "Cuenta celdas con números",
          example: "=COUNT(A1:A10)",
        },
      ],
    },
    {
      id: "operators",
      title: "Operadores",
      icon: <BiMath className="w-6 h-6" />,
      color: "red",
      items: [
        {
          label: "Suma (+)",
          description: "Suma dos valores",
          example: "=A1+B1",
        },
        {
          label: "Resta (-)",
          description: "Resta dos valores",
          example: "=A1-B1",
        },
        {
          label: "Multiplicación (*)",
          description: "Multiplica dos valores",
          example: "=A1*B1",
        },
        {
          label: "División (/)",
          description: "Divide dos valores",
          example: "=A1/B1",
        },
        {
          label: "Potencia (^)",
          description: "Eleva a una potencia",
          example: "=A1^2",
        },
        {
          label: "Paréntesis ()",
          description: "Agrupa operaciones",
          example: "=(A1+B1)*C1",
        },
      ],
    },
    {
      id: "mathfunctions",
      title: "Funciones Matemáticas",
      icon: <TbMathFunction className="w-6 h-6" />,
      color: "teal",
      items: [
        {
          label: "SENO(x) / SIN(x)",
          description: "Devuelve el seno de un ángulo en radianes",
          example: "=SENO(1.5708) → 1",
        },
        {
          label: "COSENO(x) / COS(x)",
          description: "Devuelve el coseno de un ángulo en radianes",
          example: "=COSENO(0) → 1",
        },
        {
          label: "TANGENTE(x) / TAN(x)",
          description: "Devuelve la tangente de un ángulo en radianes",
          example: "=TANGENTE(0.7854) → 1",
        },
        {
          label: "ASENO(x) / ASIN(x)",
          description: "Devuelve el arco seno (en radianes)",
          example: "=ASENO(0.5) → 0.5236",
        },
        {
          label: "ACOSENO(x) / ACOS(x)",
          description: "Devuelve el arco coseno (en radianes)",
          example: "=ACOSENO(0.5) → 1.0472",
        },
        {
          label: "ATAN(x)",
          description: "Devuelve el arco tangente (en radianes)",
          example: "=ATAN(1) → 0.7854",
        },
        {
          label: "LOGARITMO(x) / LOG(x)",
          description: "Logaritmo en base 10",
          example: "=LOGARITMO(100) → 2",
        },
        {
          label: "LN(x)",
          description: "Logaritmo natural (base e)",
          example: "=LN(2.718) → 1",
        },
        {
          label: "RAIZ(x) / SQRT(x)",
          description: "Raíz cuadrada de un número",
          example: "=RAIZ(16) → 4",
        },
        {
          label: "ABS(x)",
          description: "Valor absoluto de un número",
          example: "=ABS(-5) → 5",
        },
        {
          label: "POTENCIA(x, y) / POWER(x, y)",
          description: "Eleva x a la potencia y",
          example: "=POTENCIA(2, 3) → 8",
        },
        {
          label: "REDONDEAR(x, d) / ROUND(x, d)",
          description: "Redondea x a d decimales",
          example: "=REDONDEAR(3.456, 2) → 3.46",
        },
        {
          label: "TECHO(x) / CEILING(x)",
          description: "Redondea hacia arriba al entero más cercano",
          example: "=TECHO(3.2) → 4",
        },
        {
          label: "PISO(x) / FLOOR(x)",
          description: "Redondea hacia abajo al entero más cercano",
          example: "=PISO(3.8) → 3",
        },
        {
          label: "PI()",
          description: "Devuelve el valor de π (3.14159...)",
          example: "=PI() → 3.14159",
        },
        {
          label: "RADIANES(x) / RADIANS(x)",
          description: "Convierte grados a radianes",
          example: "=RADIANES(90) → 1.5708",
        },
        {
          label: "GRADOS(x) / DEGREES(x)",
          description: "Convierte radianes a grados",
          example: "=GRADOS(1.5708) → 90",
        },
        {
          label: "Combinando funciones",
          description:
            "Puedes usar RADIANES() para pasar grados a las funciones trigonométricas",
          example: "=SENO(RADIANES(90)) → 1",
        },
      ],
    },
    {
      id: "logical",
      title: "Funciones Lógicas",
      icon: <TbLogicAnd className="w-6 h-6" />,
      color: "cyan",
      items: [
        {
          label: "SI(condición, valor_verdadero, valor_falso)",
          description:
            "Evalúa una condición y devuelve un valor si es verdadera y otro si es falsa (equivalente a IF de Excel)",
          example: "=SI(A1>10, 100, 0)",
        },
        {
          label: "IF(condition, value_true, value_false)",
          description:
            "Versión en inglés de SI. Evalúa una condición y devuelve un valor según el resultado",
          example: "=IF(B1>=5, B1*2, B1)",
        },
        {
          label: "AND(condición1, condición2, ...)",
          description:
            "Devuelve verdadero (1) si TODAS las condiciones son verdaderas, falso (0) si alguna no lo es",
          example: "=AND(A1>0, B1<100)",
        },
        {
          label: "OR(condición1, condición2, ...) / O(...)",
          description:
            "Devuelve verdadero (1) si ALGUNA condición es verdadera, falso (0) si ninguna lo es",
          example: "=OR(A1>100, B1>100)",
        },
        {
          label: "SI con AND",
          description:
            "Combina SI con AND para evaluar múltiples condiciones que deben cumplirse todas",
          example: "=SI(AND(A1>0, A1<100), A1*2, 0)",
        },
        {
          label: "SI con OR",
          description:
            "Combina SI con OR para evaluar cuando al menos una condición se cumple",
          example: "=SI(OR(A1>100, B1>100), 1, 0)",
        },
        {
          label: "SI anidados (SINO)",
          description:
            "Anida múltiples SI para evaluar varias condiciones en cascada (equivale a IF/ELSE IF/ELSE)",
          example: "=SI(A1>100, 3, SI(A1>50, 2, SI(A1>0, 1, 0)))",
        },
        {
          label: "Operadores de comparación",
          description:
            "Usa > (mayor), < (menor), >= (mayor o igual), <= (menor o igual), == (igual), != (diferente)",
          example: "=SI(A1>=10, A1, 0)",
        },
      ],
    },
    {
      id: "goto",
      title: "Ir a Tabla (GoTo)",
      icon: <TbArrowBigRightLines className="w-6 h-6" />,
      color: "pink",
      items: [
        {
          label: "¿Qué es GoTo?",
          description:
            "Permite navegar automáticamente a una tabla de referencia según el valor de una o varias celdas. Útil cuando una celda tiene un dropdown y quieres saltar a la tabla correspondiente.",
        },
        {
          label: "Paso 1: Etiquetar rango como tabla",
          description:
            'Selecciona el rango de celdas que forma la tabla → clic derecho → "Etiquetar rango como tabla". Asigna un nombre y uno o más tags (etiquetas) separados por coma.',
          example:
            'Nombre: "Tabla Aluminio", Tags: aluminio — Nombre: "Tabla Cobre 12AWG", Tags: cobre, 12awg',
        },
        {
          label: "Paso 2: Configurar enlace GoTo en una celda",
          description:
            'Haz clic derecho en la celda desde la que quieres navegar → "Configurar Ir a tabla (GoTo)". Agrega las celdas cuyo valor se usará como condición.',
          example:
            "Si la celda C2 tiene un dropdown con opciones [aluminio, cobre], agrega C2 como celda de condición.",
        },
        {
          label: "Paso 3: Navegar",
          description:
            'Haz clic derecho en la celda con GoTo configurado → "Ir a tabla". El sistema lee los valores de las celdas de condición y busca la tabla cuyas tags coincidan.',
          example:
            'C2 = "cobre" → navega a la tabla con tag "cobre" (incluso en otra hoja).',
        },
        {
          label: "Multi-condición",
          description:
            "Puedes agregar múltiples celdas de condición. Se busca la tabla cuyas tags contengan TODOS los valores.",
          example:
            'Condiciones: C2="cobre", C3="12awg" → coincide con tabla que tenga tags: cobre, 12awg',
        },
        {
          label: "Indicadores visuales",
          description:
            "Las celdas con GoTo configurado muestran un triángulo azul (esquina inferior izquierda). Las celdas inicio de tabla etiquetada muestran un triángulo verde (esquina superior izquierda).",
        },
        {
          label: "Eliminar configuración",
          description:
            'Para quitar un GoTo: clic derecho → "Eliminar GoTo". Para quitar una tabla etiquetada: clic derecho → "Eliminar tabla etiquetada".',
        },
      ],
    },
    {
      id: "template",
      title: "GoTo en Plantillas",
      icon: <TbFileCode className="w-6 h-6" />,
      color: "amber",
      items: [
        {
          label: "Estructura general",
          description:
            "Las plantillas multi-hoja usan el campo sheets[]. Cada hoja tiene cells (celdas) y cellsStyles (estilos + tablas etiquetadas).",
          example:
            '{ "sheets": [{ "name": "Hoja 1", "cells": {...}, "cellsStyles": {...} }] }',
        },
        {
          label: "Definir una tabla etiquetada (namedRanges)",
          description:
            "Dentro de cellsStyles, agrega el array namedRanges con id, name, tags, startCell y endCell.",
          example:
            '"namedRanges": [{ "id": "nr_1", "name": "Tabla Aluminio", "tags": ["aluminio"], "startCell": "A1", "endCell": "C5" }]',
        },
        {
          label: "Definir GoTo en una celda",
          description:
            "Dentro del objeto de la celda, agrega goTo con el array conditionCells indicando qué celdas leer.",
          example:
            '"B2": { "value": "aluminio", "formula": "", "computed": "aluminio", "options": ["aluminio", "cobre"], "goTo": { "conditionCells": ["B2"] } }',
        },
        {
          label: "Campos de una celda",
          description:
            "value (texto visible), formula (fórmula si tiene), computed (valor calculado), options (dropdown), elementKey (variable de elemento), goTo (config de navegación).",
          example:
            '{ "value": "10", "formula": "=A1*2", "computed": 10, "elementKey": "voltaje" }',
        },
        {
          label: "Campos de cellsStyles",
          description:
            "columnWidths, rowHeights, hiddenRows, hiddenColumns, freezeRow, freezeColumn, mergedCells, namedRanges.",
          example:
            '"cellsStyles": { "columnWidths": {"0": 120}, "rowHeights": {}, "freezeRow": 2, "namedRanges": [...] }',
        },
        {
          label: "Ejemplo completo mínimo",
          description:
            "Hoja 1: celda B2 con dropdown y GoTo. Hoja 2: dos tablas etiquetadas con tags distintos. Al cambiar B2, el GoTo navega a la tabla correcta.",
          example:
            'Hoja1.B2: options=["aluminio","cobre"], goTo={conditionCells:["B2"]} → Hoja2.namedRanges: [{tags:["aluminio"], startCell:"A1"}, {tags:["cobre"], startCell:"A10"}]',
        },
        {
          label: "Tags multi-condición en plantilla",
          description:
            "Si necesitas que la navegación dependa de 2+ celdas, agrega todas al array conditionCells y asegúrate de que la tabla tenga todos los tags correspondientes.",
          example:
            'goTo: {conditionCells: ["B2","B3"]} → namedRanges: [{tags: ["cobre","12awg"], startCell: "A10", endCell: "F15"}]',
        },
      ],
    },
    {
      id: "tips",
      title: "Consejos Útiles",
      icon: <FaLightbulb className="w-6 h-6" />,
      color: "yellow",
      items: [
        {
          label: "Modo Fórmula",
          description: "Toda fórmula debe comenzar con =",
          example: "=A1+B1 (correcto) vs A1+B1 (incorrecto)",
        },
        {
          label: "Actualización",
          description:
            "Las fórmulas se calculan al presionar Enter o hacer clic fuera",
          example: "No se recalcula mientras escribes",
        },
        {
          label: "Biblioteca de Funciones",
          description:
            'Usa el botón "Funciones" para explorar todas las funciones disponibles',
          example: "Encuentra funciones complejas fácilmente",
        },
        {
          label: "Plantillas",
          description: "Usa plantillas predefinidas para empezar rápidamente",
          example: "Ahorra tiempo con cálculos comunes",
        },
      ],
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<
      string,
      { bg: string; border: string; text: string; hover: string }
    > = {
      blue: {
        bg: "bg-blue-50",
        border: "border-blue-200",
        text: "text-blue-700",
        hover: "hover:bg-blue-100",
      },
      green: {
        bg: "bg-green-50",
        border: "border-green-200",
        text: "text-green-700",
        hover: "hover:bg-green-100",
      },
      purple: {
        bg: "bg-purple-50",
        border: "border-purple-200",
        text: "text-purple-700",
        hover: "hover:bg-purple-100",
      },
      indigo: {
        bg: "bg-indigo-50",
        border: "border-indigo-200",
        text: "text-indigo-700",
        hover: "hover:bg-indigo-100",
      },
      orange: {
        bg: "bg-orange-50",
        border: "border-orange-200",
        text: "text-orange-700",
        hover: "hover:bg-orange-100",
      },
      red: {
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-700",
        hover: "hover:bg-red-100",
      },
      yellow: {
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        text: "text-yellow-700",
        hover: "hover:bg-yellow-100",
      },
      teal: {
        bg: "bg-teal-50",
        border: "border-teal-200",
        text: "text-teal-700",
        hover: "hover:bg-teal-100",
      },
      cyan: {
        bg: "bg-cyan-50",
        border: "border-cyan-200",
        text: "text-cyan-700",
        hover: "hover:bg-cyan-100",
      },
      pink: {
        bg: "bg-pink-50",
        border: "border-pink-200",
        text: "text-pink-700",
        hover: "hover:bg-pink-100",
      },
      amber: {
        bg: "bg-amber-50",
        border: "border-amber-200",
        text: "text-amber-700",
        hover: "hover:bg-amber-100",
      },
    };
    return colors[color] || colors.blue;
  };

  const activeData = sections.find((s) => s.id === activeSection);
  const colorClasses = activeData
    ? getColorClasses(activeData.color)
    : getColorClasses("blue");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Guía de Uso - Hoja de Cálculo"
      size="full"
      closeOnOutsideClick={false}
    >
      <div className="flex h-[600px]">
        {/* Sidebar */}
        <div className="w-80 border-r border-gray-200 pr-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            Secciones
          </h3>
          <div className="space-y-2">
            {sections.map((section) => {
              const sectionColors = getColorClasses(section.color);
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? `${sectionColors.bg} ${sectionColors.border} border-2 shadow-sm`
                      : "hover:bg-gray-50 border-2 border-transparent"
                  }`}
                >
                  <div
                    className={`${isActive ? sectionColors.text : "text-gray-400"} transition-colors`}
                  >
                    {section.icon}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isActive ? sectionColors.text : "text-gray-700"
                    }`}
                  >
                    {section.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pl-6 overflow-y-auto">
          {activeData && (
            <div className="animate-fadeIn">
              {/* Header */}
              <div
                className={`flex items-center gap-3 mb-6 p-4 rounded-lg ${colorClasses.bg}`}
              >
                <div className={colorClasses.text}>{activeData.icon}</div>
                <h2 className={`text-2xl font-bold ${colorClasses.text}`}>
                  {activeData.title}
                </h2>
              </div>

              {/* Items */}
              <div className="space-y-4">
                {activeData.items.map((item, index) => (
                  <div
                    key={index}
                    className="animate-slideIn border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 ${colorClasses.text}`}>
                        <div className="w-2 h-2 rounded-full bg-current"></div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">
                          {item.label}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">
                          {item.description}
                        </p>
                        {item.example && (
                          <div
                            className={`${colorClasses.bg} border ${colorClasses.border} rounded px-3 py-2 mt-2`}
                          >
                            <span className="text-xs text-gray-500 font-medium">
                              Ejemplo:
                            </span>
                            <code
                              className={`block mt-1 font-mono text-sm ${colorClasses.text} font-semibold`}
                            >
                              {item.example}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
          animation-fill-mode: both;
        }
      `}</style>
    </Modal>
  );
};

export default InstructionsModal;
