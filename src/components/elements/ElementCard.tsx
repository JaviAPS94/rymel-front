import type React from "react";

import { useEffect, useState } from "react";
import type { ElementResponse } from "../../commons/types";
import CountryFlag from "../core/CountryFlag";
import classNames from "classnames";
import { LockIcon } from "lucide-react";
import { Badge, Checkbox } from "@rymel/ui";

interface ElementCardProps {
  element: ElementResponse;
  onCheckChange?: (element: ElementResponse, isChecked: boolean) => void;
  isChecked?: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
}

const ElementCard: React.FC<ElementCardProps> = ({
  element,
  onCheckChange,
  isChecked = false,
  isBlocked = false,
  blockedReason,
}) => {
  const [checked, setChecked] = useState(isChecked);

  useEffect(() => {
    setChecked(isChecked);
  }, [isChecked]);

  const handleCheckChange = (checked: boolean) => {
    if (isBlocked) return;

    setChecked(checked);
    onCheckChange?.(element, checked);
  };

  return (
    <div
      key={element.id}
      className={classNames(
        "flex w-full flex-col gap-3.5 rounded-2xl p-[18px] text-sm transition-colors",
        checked
          ? "border-[1.5px] border-rymel-blue bg-[#FAFAFD]"
          : "border border-gray-300 bg-white hover:border-gray-400",
        isBlocked ? "cursor-default" : "cursor-pointer",
      )}
      onClick={() => !isBlocked && handleCheckChange(!checked)}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <Checkbox
            checked={checked}
            // La tarjeta ya alterna al hacer clic: la casilla no lo repite.
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={handleCheckChange}
            id={`element-${element.id}`}
            aria-label={`Seleccionar ${element.sapReference}`}
            disabled={isBlocked}
          />
        </div>
        <h3 className="m-0 min-w-0 flex-1 break-all font-mono text-[15px] font-bold text-gray-900">
          {element.sapReference}
        </h3>
        {isBlocked && (
          <span title={blockedReason} className="shrink-0">
            <Badge icon={<LockIcon size={12} />}>Bloqueado</Badge>
          </span>
        )}
      </div>
      <dl className="m-0 flex flex-wrap gap-6 pl-8">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-semibold text-gray-600">Norma</dt>
          <dd className="m-0 flex items-center gap-2 font-bold text-gray-900">
            <CountryFlag
              isoCode={element.norm.country.isoCode}
              className="h-[15px] w-[22px] shrink-0 rounded-[3px] object-cover"
            />
            {element.norm.name}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-semibold text-gray-600">Subtipo</dt>
          <dd className="m-0 font-bold text-gray-900">
            {element.subType.name}
          </dd>
        </div>
      </dl>
    </div>
  );
};

export default ElementCard;
