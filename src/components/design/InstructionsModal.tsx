import React, { useState } from "react";
import { Modal } from "../core/Modal";
import { FaKeyboard, FaCalculator, FaLightbulb } from "react-icons/fa";
import { MdFunctions } from "react-icons/md";
import { BiMath } from "react-icons/bi";
import { TbTableOptions } from "react-icons/tb";

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
