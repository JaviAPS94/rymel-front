import { Design } from "../../commons/types";
import Button from "../core/Button";
import CountryFlag from "../core/CountryFlag";
import { BiCopy } from "react-icons/bi";

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

  const norm = design.designElements[0]?.element.norm;

  return (
    <article
      className="fade-in-up flex flex-col gap-4 rounded-[18px] border border-gray-300 bg-white p-5 transition-shadow hover:shadow-float"
      style={{
        animationDelay: `${index * 100}ms`,
        opacity: 0,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="m-0 text-[17px] font-extrabold text-gray-900">
            {design.name}
          </h3>
          <span className="break-all font-mono text-[13px] text-gray-600">
            {design.code}
          </span>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {design.designSubType?.designType.name && (
            <span className="flex h-[26px] items-center rounded-full bg-rymel-soft px-2.5 text-xs font-bold text-rymel-indigo">
              {design.designSubType.designType.name}
            </span>
          )}
          {design.designSubType?.name && (
            <span className="flex h-[26px] items-center rounded-lg border border-gray-300 px-2 text-xs font-bold">
              {design.designSubType.name}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {[
          { value: design.designElements.length, label: "Elementos" },
          { value: design.subDesigns.length, label: "Sub-diseños" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-baseline gap-2 rounded-xl bg-surface p-3.5"
          >
            <span className="text-[26px] font-extrabold tabular-nums text-rymel-blue">
              {stat.value}
            </span>
            <span className="text-[13px] font-semibold text-gray-600">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {norm ? (
          <span className="flex items-center gap-2 font-bold">
            <CountryFlag
              isoCode={norm.country.isoCode}
              className="h-[15px] w-[22px] rounded-[3px] object-cover"
            />
            {norm.name} · {norm.country.name}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[13px] text-gray-600">
          Act. {formatDate(design.updatedAt)}
        </span>
      </div>

      <div className="mt-auto flex gap-2 border-t border-[#EFEEF5] pt-4">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => onClick(design)}
        >
          Ver detalles
        </Button>
        {isReused && (
          <Button
            primary
            className="flex-1"
            icon={<BiCopy className="h-4 w-4" />}
            onClick={onClickCopy}
          >
            Usar como base
          </Button>
        )}
      </div>
    </article>
  );
}
