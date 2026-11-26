import type { ReactNode } from "react";
import { Badge, Checkbox, TableCard, Tag } from "@rymel/ui";
import type { ElementResponse } from "../../commons/types";
import CountryFlag from "../core/CountryFlag";

interface ElementTableProps {
  items: ElementResponse[];
  selectedIds: Set<number>;
  onToggle: (element: ElementResponse, isChecked: boolean) => void;
  /** Pie de la tarjeta: la paginación. */
  footer?: ReactNode;
}

/** Elementos elegibles para un diseño: una fila por elemento, se marca con un clic. */
const ElementTable = ({
  items,
  selectedIds,
  onToggle,
  footer,
}: ElementTableProps) => (
  <TableCard aria-label="Elementos disponibles" footer={footer}>
    <table className="rm-table rm-table-compact">
      <thead>
        <tr>
          <th className="w-14">
            <span className="sr-only">Seleccionar</span>
          </th>
          <th>Referencia ERP</th>
          <th>Norma</th>
          <th>Versión</th>
          <th>País</th>
          <th>Subtipo</th>
        </tr>
      </thead>
      <tbody>
        {items.map((element) => {
          const isSelected = selectedIds.has(element.id);

          return (
            <tr
              key={element.id}
              onClick={() => onToggle(element, !isSelected)}
              aria-selected={isSelected}
              className="cursor-pointer"
            >
              <td>
                <Checkbox
                  checked={isSelected}
                  // La fila ya alterna al hacer clic: la casilla no lo repite.
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={(checked) => onToggle(element, checked)}
                  id={`element-${element.id}`}
                  aria-label={`Seleccionar ${element.sapReference}`}
                />
              </td>
              <td className="whitespace-nowrap font-mono text-[13.5px] font-medium">
                {element.sapReference}
              </td>
              <td className="font-bold">{element.norm.name}</td>
              <td>
                <Tag mono>{element.norm.version}</Tag>
              </td>
              <td>
                <div className="flex items-center gap-2.5 whitespace-nowrap">
                  <CountryFlag
                    isoCode={element.norm.country.isoCode}
                    className="h-4 w-6 shrink-0 rounded-[3px] object-cover"
                  />
                  {element.norm.country.name}
                </div>
              </td>
              <td>
                <Badge tone="brand">{element.subType.name}</Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </TableCard>
);

export default ElementTable;
