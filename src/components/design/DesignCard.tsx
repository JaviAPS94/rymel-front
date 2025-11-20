import { Design } from "../../commons/types";
import Button from "../core/Button";
import CountryFlag from "../core/CountryFlag";
import { BiCopy } from "react-icons/bi";
import { Activity } from "react";
import TooltipGeneral from "../core/TooltipGeneral";

interface DesignCardProps {
  design: Design;
  index?: number;
  onClick: (design: Design) => void;
  onClickCopy?: () => void;
  isReused?: boolean;
}

export default function DesignCard({
  design,
  index = 0,
  onClick,
  onClickCopy,
  isReused = false,
}: DesignCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      className="fade-in-up border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-blue-300 group"
      style={{
        animationDelay: `${index * 100}ms`,
        opacity: 0,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {design.name}
          </h3>
          <p className="text-sm text-gray-500 font-mono">{design.code}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
            {design.designSubType?.designType.name}
          </span>
          <div
            className={`flex ${
              isReused ? "justify-between" : "justify-end"
            } w-full`}
          >
            <Activity mode={isReused ? "visible" : "hidden"}>
              <TooltipGeneral
                content="Copiar Cálculos"
                position="bottom"
                delay={100}
              >
                <Button outline onClick={onClickCopy}>
                  <BiCopy className="text-blue-600 hover:text-blue-800" />
                </Button>
              </TooltipGeneral>
            </Activity>
            <span className="text-xs text-gray-500 mt-1">
              {design.designSubType?.name}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-blue-600">
            {design.designElements.length}
          </div>
          <div className="text-xs text-gray-600">Elementos</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-600">
            {design.subDesigns.length}
          </div>
          <div className="text-xs text-gray-600">Sub-diseños</div>
        </div>
      </div>

      {/* Technical Info */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Norma:</span>
          <span className="font-medium text-orange-600">
            {design.designElements[0]?.element.norm.name}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">País:</span>
          <CountryFlag
            isoCode={design.designElements[0]?.element.norm.country.isoCode}
            className="w-8 h-5 object-cover ml-2"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Actualizado: {formatDate(design.updatedAt)}
          </span>
          <div
            onClick={() => onClick(design)}
            className="text-blue-600 cursor-pointer group-hover:text-blue-800 transition-colors"
          >
            <span className="text-sm font-medium">Ver detalles →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
